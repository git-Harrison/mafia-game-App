import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';

// M2-b 통합 테스트.
//   - 4명이 같은 방 입장 → 호스트 startGame
//   - 각 클라가 assignRoles 받음 (역할 분포: 1 MAFIA, 1 POLICE, 1 DOCTOR, 1 CITIZEN)
//   - 전원이 housesAssigned 받음
//   - 액션 없이 빈 사이클 한 바퀴의 phaseChanged 시퀀스 검증
//
// 타이머는 env 로 1초씩 단축. EXECUTION 은 spec 상 3s 고정.

describe('M2-b — phase machine empty cycle', () => {
  let app: INestApplication;
  let baseUrl: string;
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    // env 단축 — 모듈 컴파일 전에 적용해야 GAME_DURATIONS factory 가 읽음.
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
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '0.0.0.0');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://localhost:${port}`;
  }, 30_000);

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
    // 50ms 폴링 — 페이즈 전이가 sub-second 단위가 아니라 OK.
    while (!cond()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`waitUntil(${label}) timeout`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // ─── test ──────────────────────────────────────────
  it('4명 startGame → assignRoles + housesAssigned + 빈 사이클 1바퀴 phaseChanged 시퀀스', async () => {
    const A = await newGuest('alpha');
    const B = await newGuest('bravo');
    const C = await newGuest('charlie');
    const D = await newGuest('delta');

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

    // startGame 직후 emit 되는 이벤트들을 놓치지 않게 startGame 전에 listener 등록.
    const assignA = collect<{ role: string }>(sa, 'assignRoles');
    const assignB = collect<{ role: string }>(sb, 'assignRoles');
    const assignC = collect<{ role: string }>(sc, 'assignRoles');
    const assignD = collect<{ role: string }>(sd, 'assignRoles');

    const housesA = collect<{ map: { userId: string; houseId: string }[] }>(
      sa,
      'housesAssigned',
    );
    const housesB = collect(sb, 'housesAssigned');
    const housesC = collect(sc, 'housesAssigned');
    const housesD = collect(sd, 'housesAssigned');

    const phasesA = collect<{ phase: string; endsAt: number; nightNumber?: number }>(
      sa,
      'phaseChanged',
    );

    // 방 생성 → 입장 → ready → startGame
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

    // assignRoles — 각 클라 1번씩
    await waitUntil(
      () =>
        assignA.length === 1 &&
        assignB.length === 1 &&
        assignC.length === 1 &&
        assignD.length === 1,
      3000,
      'assignRoles received by all 4',
    );
    const roles = [assignA[0].role, assignB[0].role, assignC[0].role, assignD[0].role];
    expect([...roles].sort()).toEqual(['CITIZEN', 'DOCTOR', 'MAFIA', 'POLICE']);

    // housesAssigned — 4명 모두 같은 페이로드(룸 브로드캐스트)
    await waitUntil(
      () =>
        housesA.length === 1 &&
        housesB.length === 1 &&
        housesC.length === 1 &&
        housesD.length === 1,
      3000,
      'housesAssigned received by all 4',
    );
    expect(housesA[0].map).toHaveLength(4);

    // 빈 사이클 한 바퀴 phaseChanged 시퀀스 (호스트 A 기준):
    // DAY_DISCUSSION (즉시) → VOTE_SELECT → EXECUTION → NIGHT_DOCTOR → NIGHT_MAFIA → NIGHT_POLICE → NIGHT_RESULT → DAY_DISCUSSION
    //
    // env 1s × 6 phases + EXECUTION 3s = 약 9초. 여유 25s.
    await waitUntil(() => phasesA.length >= 8, 25_000, 'phaseChanged x 8');

    const seq = phasesA.slice(0, 8).map((e) => e.phase);
    expect(seq).toEqual([
      'DAY_DISCUSSION',
      'VOTE_SELECT',
      'EXECUTION',
      'NIGHT_DOCTOR',
      'NIGHT_MAFIA',
      'NIGHT_POLICE',
      'NIGHT_RESULT',
      'DAY_DISCUSSION',
    ]);

    // 밤 페이즈만 nightNumber 포함
    const dayEvents = phasesA.filter((e) => e.phase === 'DAY_DISCUSSION');
    const nightDoctor = phasesA.find((e) => e.phase === 'NIGHT_DOCTOR');
    const nightResult = phasesA.find((e) => e.phase === 'NIGHT_RESULT');
    expect(dayEvents[0].nightNumber).toBeUndefined();
    expect(nightDoctor!.nightNumber).toBe(1);
    expect(nightResult!.nightNumber).toBe(1);

    disconnectAll(sa, sb, sc, sd);
  }, 40_000);
});
