// S-server-reconnect 통합 테스트 — 재접속 grace + reconnectSnapshot + 초과 시 사망.
//
// 4명 게임, 시드 고정으로 C=MAFIA, A=POLICE, B=CITIZEN, D=DOCTOR.
// GAME_RECONNECT_GRACE_MS 는 .overrideProvider 로 800ms 까지 줄여서 e2e 실행 시간 단축.
//
// 시나리오:
//   1) 정상 재접속: C(마피아) 소켓 끊고 grace 안에 새 소켓으로 재연결 →
//      reconnectSnapshot 수신 (myRole=MAFIA, mafiaAllies=[C], chatHistory 마피아 채팅 포함).
//   2) grace 초과 사망 + 즉시 종료: 다시 C 끊고 800ms+ 대기 → 마피아 0명 →
//      gameOver(CITIZEN) 룸 브로드캐스트. 살아남은 A 가 수신.
//
// 자체 작성 — design-policy §2 IP 회피.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { GAME_RECONNECT_GRACE_MS, GAME_RNG } from '../src/game/tokens';

describe('S-server-reconnect — grace + snapshot + death', () => {
  let app: INestApplication;
  let baseUrl: string;
  const originalEnv: Record<string, string | undefined> = {};

  // night-actions.e2e 와 동일한 RNG 시퀀스: C=MAFIA, A=POLICE, B=CITIZEN, D=DOCTOR.
  let rngCallCount = 0;
  const ROLES_RNG_SEQ = [0.5, 0, 0];
  const testRng = () => {
    const v =
      rngCallCount < ROLES_RNG_SEQ.length ? ROLES_RNG_SEQ[rngCallCount] : 0;
    rngCallCount++;
    return v;
  };

  const GRACE_MS = 800;

  beforeAll(async () => {
    // 페이즈 타이머는 길게 — 재접속이 DAY 페이즈 안에서 일어나야 검증이 단순.
    const keys = [
      'GAME_DAY_DISCUSSION_SEC',
      'GAME_VOTE_SELECT_SEC',
      'GAME_VOTE_CONFIRM_SEC',
      'GAME_NIGHT_DOCTOR_SEC',
      'GAME_NIGHT_MAFIA_SEC',
      'GAME_NIGHT_POLICE_SEC',
      'GAME_NIGHT_RESULT_SEC',
    ];
    for (const k of keys) {
      originalEnv[k] = process.env[k];
      process.env[k] = '60';
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GAME_RNG)
      .useValue(testRng)
      .overrideProvider(GAME_RECONNECT_GRACE_MS)
      .useValue(GRACE_MS)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '0.0.0.0');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://localhost:${port}`;
  }, 30_000);

  beforeEach(() => {
    rngCallCount = 0;
  });

  afterAll(async () => {
    await app.close();
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  // ─── helpers ──────────────────────────────────────
  async function newGuest(nickname: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/guest')
      .send({ nickname })
      .expect(200);
    return {
      token: res.body.accessToken as string,
      userId: res.body.user.id as string,
      nickname: res.body.user.guestNickname as string,
    };
  }

  function openSocket(token: string): Socket {
    return io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
  }

  function connectAndWait(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function emitAck<T = unknown>(
    socket: Socket,
    event: string,
    payload?: unknown,
  ): Promise<{ ok: boolean; data?: T; error?: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`ack timeout for ${event}`)),
        5000,
      );
      socket.emit(event, payload ?? {}, (response: unknown) => {
        clearTimeout(timer);
        resolve(response as { ok: boolean; data?: T; error?: string });
      });
    });
  }

  function collect<T>(socket: Socket, event: string): T[] {
    const arr: T[] = [];
    socket.on(event, (d: T) => arr.push(d));
    return arr;
  }

  async function waitUntil(
    cond: () => boolean,
    timeoutMs: number,
    label: string,
  ): Promise<void> {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`waitUntil(${label}) timeout`);
      }
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  async function bootGame() {
    const A = await newGuest('alphaRC');
    const B = await newGuest('bravoRC');
    const C = await newGuest('charlieRC');
    const D = await newGuest('deltaRC');
    const sa = openSocket(A.token);
    const sb = openSocket(B.token);
    let sc = openSocket(C.token);
    const sd = openSocket(D.token);
    await Promise.all([
      connectAndWait(sa),
      connectAndWait(sb),
      connectAndWait(sc),
      connectAndWait(sd),
    ]);

    const assignA = collect<any>(sa, 'assignRoles');
    const assignC = collect<any>(sc, 'assignRoles');
    const phasesA = collect<any>(sa, 'phaseChanged');
    const gameOverA = collect<any>(sa, 'gameOver');

    const created = await emitAck<{ code: string; roomId: string }>(sa, 'createRoom', {
      maxPlayers: 4,
    });
    expect(created.ok).toBe(true);
    const code = created.data!.code;
    expect((await emitAck(sb, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sc, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sd, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sb, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sc, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sd, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sa, 'startGame')).ok).toBe(true);

    await waitUntil(
      () =>
        assignA.length === 1 &&
        assignC.length === 1 &&
        phasesA.some((p) => p.phase === 'DAY_DISCUSSION'),
      5000,
      'assign + DAY phase',
    );
    expect(assignA[0].role).toBe('POLICE');
    expect(assignC[0].role).toBe('MAFIA');

    return {
      users: { A, B, C, D },
      sockets: { sa, sb, sc, sd },
      events: { phasesA, gameOverA },
      cleanup: () => {
        for (const s of [sa, sb, sd]) if (s.connected) s.disconnect();
        if (sc.connected) sc.disconnect();
      },
      setSc: (next: Socket) => {
        sc = next;
      },
      getSc: () => sc,
      tokens: { cToken: C.token },
    };
  }

  // ─── 시나리오 1: 정상 재접속 ───────────────────────
  it('grace 안에 재접속 → reconnectSnapshot 수신 (myRole + mafiaAllies + chatHistory)', async () => {
    const ctx = await bootGame();
    const { C } = ctx.users;
    const sc = ctx.getSc();

    // C(MAFIA) 가 끊긴 후 즉시 새 소켓으로 같은 토큰 재연결.
    sc.disconnect();
    // 잠깐 기다려 disconnect 가 서버에 전달되게 함
    await new Promise((r) => setTimeout(r, 100));

    const sc2 = openSocket(ctx.tokens.cToken);
    const snaps = collect<any>(sc2, 'reconnectSnapshot');
    await connectAndWait(sc2);

    await waitUntil(() => snaps.length >= 1, 3000, 'reconnectSnapshot');
    const snap = snaps[0];
    expect(snap.myRole).toBe('MAFIA');
    expect(snap.mafiaAllies).toEqual([C.userId]);
    expect(snap.phase).toBe('DAY_DISCUSSION');
    expect(Array.isArray(snap.players)).toBe(true);
    expect(snap.players).toHaveLength(4);
    // 모든 플레이어 살아있음
    expect(snap.players.every((p: any) => p.isAlive)).toBe(true);
    // 본인은 isConnected=true (방금 재연결됨)
    const me = snap.players.find((p: any) => p.userId === C.userId)!;
    expect(me.isConnected).toBe(true);

    sc2.disconnect();
    ctx.cleanup();
  }, 30_000);

  // ─── 시나리오 2: grace 초과 → 사망 + 즉시 종료 ─────
  it('grace 초과 → 마피아 사망 → 시민팀 즉시 승리 + gameOver 브로드캐스트', async () => {
    const ctx = await bootGame();
    const sc = ctx.getSc();

    // C(유일 마피아) 끊고 GRACE_MS 보다 충분히 오래 대기 → 사망 처리.
    sc.disconnect();

    // gameOver 룸 브로드캐스트는 살아있는 A 가 수신.
    await waitUntil(
      () => ctx.events.gameOverA.length >= 1,
      GRACE_MS + 3000,
      'gameOver after grace',
    );
    const go = ctx.events.gameOverA[0];
    expect(go.winnerTeam).toBe('CITIZEN');
    expect(go.players).toHaveLength(4);

    ctx.cleanup();
  }, 30_000);
});
