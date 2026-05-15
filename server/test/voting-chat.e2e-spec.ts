// M2-c-a 통합 테스트 — 투표 + 채팅 흐름.
//
// 시나리오 (4명, 시드 고정해서 C = MAFIA 보장):
//   A=POLICE, B=CITIZEN, C=MAFIA, D=DOCTOR
//
//   1) majority 시나리오: DAY 채팅 3개 → VOTE_SELECT A·B·D→C → VOTE_CONFIRM
//      A·B·D 모두 찬성 (approves=3, total=4 → 6>4 → majority) → executionResult
//      majority + victim=C → C 사망 → 시민팀 승 → gameOver
//   2) no_majority 회귀: 동일 setup, VOTE_CONFIRM 에서 A·B 찬성 / D 반대 →
//      approves=2 → 4>4 false → no_majority → C 생존 → NIGHT_DOCTOR 진입
//   3) 후보 C 가 confirmExecutionVote → ack ok:false CANDIDATE_CANNOT_VOTE
//   4) 시민(B)이 NIGHT_MAFIA 에서 sendMafiaChat → ack ok:false FORBIDDEN
//
// 테스트용 닉네임·시나리오 카피는 모두 자체 작성 (mafia-app-design-policy.md §2 항 3).
//
// 페이즈 env 1s 단축 + EXECUTION 3s (고정) → 한 시나리오 ~7s, 전체 ~30s.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { GAME_RNG } from '../src/game/tokens';

describe('M2-c-a — voting + chat', () => {
  let app: INestApplication;
  let baseUrl: string;
  const originalEnv: Record<string, string | undefined> = {};

  // 시드 고정 rng — assignRoles(4) 첫 3개 호출에 [0.5, 0, 0] 주입 시
  // roles 결과: [POLICE, CITIZEN, MAFIA, DOCTOR] → C(3번째) 가 MAFIA.
  // 이후 호출(집 슬롯 셔플 등)은 0 반환. 매 테스트 beforeEach 에서 카운터 reset.
  let rngCallCount = 0;
  const ROLES_RNG_SEQ = [0.5, 0, 0];
  const testRng = () => {
    const v =
      rngCallCount < ROLES_RNG_SEQ.length ? ROLES_RNG_SEQ[rngCallCount] : 0;
    rngCallCount++;
    return v;
  };

  beforeAll(async () => {
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
      process.env[k] = '1';
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GAME_RNG)
      .useValue(testRng)
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

  function disconnectAll(...sockets: Socket[]) {
    for (const s of sockets) s.disconnect();
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
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // 4명 세팅 → ready → startGame 까지. 호출 측은 sockets 와 phaseEvents collector 만 받음.
  async function bootGame(nicknames: [string, string, string, string]) {
    const A = await newGuest(nicknames[0]);
    const B = await newGuest(nicknames[1]);
    const C = await newGuest(nicknames[2]);
    const D = await newGuest(nicknames[3]);

    const sa = openSocket(A.token);
    const sb = openSocket(B.token);
    const sc = openSocket(C.token);
    const sd = openSocket(D.token);
    await Promise.all([
      connectAndWait(sa),
      connectAndWait(sb),
      connectAndWait(sc),
      connectAndWait(sd),
    ]);

    // 각 클라가 받을 이벤트 컬렉터들. startGame 전에 부착.
    const events = {
      assignA: collect<any>(sa, 'assignRoles'),
      assignB: collect<any>(sb, 'assignRoles'),
      assignC: collect<any>(sc, 'assignRoles'),
      assignD: collect<any>(sd, 'assignRoles'),
      phasesA: collect<any>(sa, 'phaseChanged'),
      chatA: collect<any>(sa, 'chatMessage'),
      voteCastA: collect<any>(sa, 'voteCast'),
      executionA: collect<any>(sa, 'executionResult'),
      gameOverA: collect<any>(sa, 'gameOver'),
      mafiaChatB: collect<any>(sb, 'mafiaChat'),
      mafiaChatC: collect<any>(sc, 'mafiaChat'),
    };

    const created = await emitAck<{ code: string }>(sa, 'createRoom', {
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

    // assignRoles 검증 — 시드 고정 결과: C=MAFIA, D=DOCTOR
    await waitUntil(
      () =>
        events.assignA.length === 1 &&
        events.assignB.length === 1 &&
        events.assignC.length === 1 &&
        events.assignD.length === 1,
      3000,
      'assignRoles x 4',
    );
    expect(events.assignA[0].role).toBe('POLICE');
    expect(events.assignB[0].role).toBe('CITIZEN');
    expect(events.assignC[0].role).toBe('MAFIA');
    expect(events.assignD[0].role).toBe('DOCTOR');

    return {
      users: { A, B, C, D },
      sockets: { sa, sb, sc, sd },
      events,
      cleanup: () => disconnectAll(sa, sb, sc, sd),
    };
  }

  // ───────────────────────────────────────────────────
  // 1) majority 시나리오 — 시민 승
  // ───────────────────────────────────────────────────
  it('majority: A·B·D 가 C 처형 → 시민팀 승 → gameOver', async () => {
    const { users, sockets, events, cleanup } = await bootGame([
      'alpha1',
      'bravo1',
      'charlie1',
      'delta1',
    ]);
    const { A: _A, B, C, D } = users;
    const { sa, sb, sc, sd } = sockets;

    // DAY: 채팅 3개
    expect((await emitAck(sa, 'sendChatMessage', { text: 'first message' })).ok).toBe(true);
    expect((await emitAck(sb, 'sendChatMessage', { text: 'second message' })).ok).toBe(true);
    expect((await emitAck(sc, 'sendChatMessage', { text: 'third message' })).ok).toBe(true);
    await waitUntil(() => events.chatA.length >= 3, 3000, 'chatMessage x 3');
    expect(events.chatA.map((c) => c.text)).toEqual([
      'first message',
      'second message',
      'third message',
    ]);

    // VOTE_SELECT 진입까지 대기
    await waitUntil(
      () => events.phasesA.some((p) => p.phase === 'VOTE_SELECT'),
      5000,
      'VOTE_SELECT entered',
    );

    // A·B·D 모두 C 에게 투표
    expect((await emitAck(sa, 'selectVoteTarget', { targetUserId: C.userId })).ok).toBe(true);
    expect((await emitAck(sb, 'selectVoteTarget', { targetUserId: C.userId })).ok).toBe(true);
    expect((await emitAck(sd, 'selectVoteTarget', { targetUserId: C.userId })).ok).toBe(true);
    await waitUntil(() => events.voteCastA.length >= 3, 3000, 'voteCast x 3');

    // VOTE_CONFIRM 진입 대기
    await waitUntil(
      () => events.phasesA.some((p) => p.phase === 'VOTE_CONFIRM'),
      5000,
      'VOTE_CONFIRM entered',
    );

    // 후보(C) 본인이 confirm → CANDIDATE_CANNOT_VOTE
    const cTries = await emitAck(sc, 'confirmExecutionVote', { approve: true });
    expect(cTries).toEqual({ ok: false, error: 'CANDIDATE_CANNOT_VOTE' });

    // 비후보 3명 모두 찬성 → approves=3, total=4 → 6>4 → majority
    expect((await emitAck(sa, 'confirmExecutionVote', { approve: true })).ok).toBe(true);
    expect((await emitAck(sb, 'confirmExecutionVote', { approve: true })).ok).toBe(true);
    expect((await emitAck(sd, 'confirmExecutionVote', { approve: true })).ok).toBe(true);

    // EXECUTION 진입 + executionResult emit 대기
    await waitUntil(
      () => events.executionA.length >= 1,
      5000,
      'executionResult emit',
    );
    expect(events.executionA[0]).toEqual({
      reason: 'majority',
      victimUserId: C.userId,
    });

    // gameOver 대기 (EXECUTION 끝 = 3s 후 win check → 마피아=0 → CITIZEN 승)
    await waitUntil(() => events.gameOverA.length >= 1, 8000, 'gameOver emit');
    const go = events.gameOverA[0];
    expect(go.winnerTeam).toBe('CITIZEN');
    expect(go.players).toHaveLength(4);
    const winners = new Set(go.players.filter((p: any) => p.isWinner).map((p: any) => p.userId));
    const losers = new Set(go.players.filter((p: any) => !p.isWinner).map((p: any) => p.userId));
    expect(winners.has(C.userId)).toBe(false);
    expect(losers.has(C.userId)).toBe(true);
    expect(winners.has(B.userId)).toBe(true);
    expect(winners.has(D.userId)).toBe(true);

    cleanup();
  }, 30_000);

  // ───────────────────────────────────────────────────
  // 2) no_majority 회귀
  // ───────────────────────────────────────────────────
  it('no_majority: A·B 찬성 / D 반대 → C 생존 → NIGHT_DOCTOR 진입', async () => {
    const { users, sockets, events, cleanup } = await bootGame([
      'alpha2',
      'bravo2',
      'charlie2',
      'delta2',
    ]);
    const { C } = users;
    const { sa, sb, sd } = sockets;

    // VOTE_SELECT 진입 대기 후 동일 패턴 (A·B·D → C)
    await waitUntil(
      () => events.phasesA.some((p) => p.phase === 'VOTE_SELECT'),
      5000,
      'VOTE_SELECT',
    );
    await emitAck(sa, 'selectVoteTarget', { targetUserId: C.userId });
    await emitAck(sb, 'selectVoteTarget', { targetUserId: C.userId });
    await emitAck(sd, 'selectVoteTarget', { targetUserId: C.userId });

    await waitUntil(
      () => events.phasesA.some((p) => p.phase === 'VOTE_CONFIRM'),
      5000,
      'VOTE_CONFIRM',
    );

    // 2 찬성 + 1 반대 → approves=2, total=4 → 4>4 false → no_majority
    expect((await emitAck(sa, 'confirmExecutionVote', { approve: true })).ok).toBe(true);
    expect((await emitAck(sb, 'confirmExecutionVote', { approve: true })).ok).toBe(true);
    expect((await emitAck(sd, 'confirmExecutionVote', { approve: false })).ok).toBe(true);

    await waitUntil(
      () => events.executionA.length >= 1,
      5000,
      'executionResult emit',
    );
    expect(events.executionA[0]).toEqual({
      reason: 'no_majority',
      victimUserId: null,
    });

    // gameOver 는 와선 안 됨 (C 생존 → 1 mafia + 3 citizens → 균형 유지)
    expect(events.gameOverA).toHaveLength(0);

    // EXECUTION(3s) 끝나면 NIGHT_DOCTOR 진입
    await waitUntil(
      () => events.phasesA.some((p) => p.phase === 'NIGHT_DOCTOR'),
      8000,
      'NIGHT_DOCTOR entered',
    );
    const nightDoctor = events.phasesA.find((p) => p.phase === 'NIGHT_DOCTOR')!;
    expect(nightDoctor.nightNumber).toBe(1);

    cleanup();
  }, 30_000);

  // ───────────────────────────────────────────────────
  // 3) 시민의 sendMafiaChat → FORBIDDEN
  // ───────────────────────────────────────────────────
  it('시민(B)이 NIGHT_MAFIA 에서 sendMafiaChat → FORBIDDEN, 마피아(C)는 OK', async () => {
    const { sockets, events, cleanup } = await bootGame([
      'alpha3',
      'bravo3',
      'charlie3',
      'delta3',
    ]);
    const { sb, sc } = sockets;

    // 액션 없이 VOTE_SELECT 통과 → EXECUTION(no_votes) → NIGHT_DOCTOR → NIGHT_MAFIA
    await waitUntil(
      () => events.phasesA.some((p) => p.phase === 'NIGHT_MAFIA'),
      12_000,
      'NIGHT_MAFIA entered',
    );

    // 시민(B)이 마피아 채팅 시도 → FORBIDDEN
    const bRes = await emitAck(sb, 'sendMafiaChat', { text: 'i am citizen' });
    expect(bRes).toEqual({ ok: false, error: 'FORBIDDEN' });

    // 마피아(C)는 OK → 본인 mafiaChat 수신
    const cRes = await emitAck(sc, 'sendMafiaChat', { text: 'mafia hello' });
    expect(cRes.ok).toBe(true);
    await waitUntil(() => events.mafiaChatC.length >= 1, 3000, 'mafiaChat to C');
    expect(events.mafiaChatC[0].text).toBe('mafia hello');

    // 시민(B)에게는 mafiaChat 가 와선 안 됨
    expect(events.mafiaChatB).toHaveLength(0);

    cleanup();
  }, 30_000);
});
