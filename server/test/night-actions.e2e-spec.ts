// M2-c-b 통합 테스트 — 밤 액션 + nightResult/policeResult + Postgres INSERT.
//
// 4명, 시드 고정으로 C=MAFIA, D=DOCTOR, A=POLICE, B=CITIZEN.
//
// 시나리오 (한 게임 안에서 순차 검증):
//   1) 첫 밤 — 보호 성공: D→A집, C→A집, A→C집 → 매치 → 사망자 없음.
//      policeResult: { targetUserId: C, isMafia: true } A 본인에게만.
//   2) 둘째 밤 — 보호 실패: D→A집(다른 곳), C→B집, A→B집 → B 사망.
//      policeResult: { targetUserId: B, isMafia: false } A 본인에게만.
//   3) 다음 낮 — 마피아 처형: A, D 가 C 에게 투표 → 후보 C → A·D 모두 찬성 →
//      approves=2, total=3 → 4>3 → majority → C 사망 → 시민팀 승 → gameOver.
//   4) 게임 종료 후 Prisma Game/GamePlayer INSERT 검증.
//   5) 시민(B) 클라가 houseEntered / policeResult 수신 못 했는지 검증 (서버 권위 시야).
//
// 별도 케이스: D 가 처형으로 사망 → 다음 밤 phaseSkipped(NIGHT_DOCTOR) emit → 3s 후 NIGHT_MAFIA.
//
// 테스트 닉네임·시나리오 카피 모두 자체 작성 (mafia-app-design-policy.md §2 항 3).
// 이벤트명·에러 코드 모두 기능 서술형 — Heal/Investigate 같은 게임 시그니처 단어 회피.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GAME_RNG } from '../src/game/tokens';

describe('M2-c-b — night actions + persistence', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  const originalEnv: Record<string, string | undefined> = {};

  let rngCallCount = 0;
  const ROLES_RNG_SEQ = [0.5, 0, 0]; // C=MAFIA, A=POLICE, B=CITIZEN, D=DOCTOR
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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GAME_RNG)
      .useValue(testRng)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '0.0.0.0');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://localhost:${port}`;
    prisma = app.get(PrismaService);
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
    cond: () => boolean | Promise<boolean>,
    timeoutMs: number,
    label: string,
  ): Promise<void> {
    const start = Date.now();
    while (true) {
      const ok = await cond();
      if (ok) return;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`waitUntil(${label}) timeout`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

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

    const events = {
      assignA: collect<any>(sa, 'assignRoles'),
      assignB: collect<any>(sb, 'assignRoles'),
      assignC: collect<any>(sc, 'assignRoles'),
      assignD: collect<any>(sd, 'assignRoles'),
      housesA: collect<any>(sa, 'housesAssigned'),
      phasesA: collect<any>(sa, 'phaseChanged'),
      phasesB: collect<any>(sb, 'phaseChanged'),
      phasesD: collect<any>(sd, 'phaseChanged'),
      skipsA: collect<any>(sa, 'phaseSkipped'),
      houseEnteredA: collect<any>(sa, 'houseEntered'),
      houseEnteredB: collect<any>(sb, 'houseEntered'),
      houseEnteredC: collect<any>(sc, 'houseEntered'),
      houseEnteredD: collect<any>(sd, 'houseEntered'),
      nightResultA: collect<any>(sa, 'nightResult'),
      nightResultB: collect<any>(sb, 'nightResult'),
      policeResultA: collect<any>(sa, 'policeResult'),
      policeResultB: collect<any>(sb, 'policeResult'),
      executionA: collect<any>(sa, 'executionResult'),
      gameOverA: collect<any>(sa, 'gameOver'),
      gameOverB: collect<any>(sb, 'gameOver'),
    };

    const created = await emitAck<{ code: string; roomId: string }>(sa, 'createRoom', {
      maxPlayers: 4,
    });
    expect(created.ok).toBe(true);
    const code = created.data!.code;
    const roomId = created.data!.roomId;
    expect((await emitAck(sb, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sc, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sd, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sb, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sc, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sd, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sa, 'startGame')).ok).toBe(true);

    await waitUntil(
      () =>
        events.assignA.length === 1 &&
        events.assignB.length === 1 &&
        events.assignC.length === 1 &&
        events.assignD.length === 1 &&
        events.housesA.length === 1,
      3000,
      'assign + houses',
    );
    expect(events.assignA[0].role).toBe('POLICE');
    expect(events.assignB[0].role).toBe('CITIZEN');
    expect(events.assignC[0].role).toBe('MAFIA');
    expect(events.assignD[0].role).toBe('DOCTOR');

    // 각자 자기 houseId
    const housesMap = new Map<string, string>(
      events.housesA[0].map.map((m: any) => [m.userId, m.houseId]),
    );
    const houseOf = (userId: string) => housesMap.get(userId)!;

    return {
      users: { A, B, C, D },
      sockets: { sa, sb, sc, sd },
      events,
      roomId,
      houseOf,
      cleanup: () => disconnectAll(sa, sb, sc, sd),
    };
  }

  async function waitForPhase(events: { phasesA: any[] }, phase: string, timeoutMs = 8000) {
    await waitUntil(
      () => events.phasesA.some((p) => p.phase === phase),
      timeoutMs,
      `phase=${phase}`,
    );
  }

  function phaseEntries(events: { phasesA: any[] }, phase: string): any[] {
    return events.phasesA.filter((p) => p.phase === phase);
  }

  // ─────────────────────────────────────────────────
  // 큰 시나리오: 시나리오 1·2·3 + INSERT + 시민 차단 검증
  // ─────────────────────────────────────────────────
  it('순차 시나리오 — 보호 성공 → 보호 실패 → 마피아 처형 → 시민 승 + Prisma INSERT', async () => {
    const { users, sockets, events, roomId, houseOf, cleanup } = await bootGame([
      'alphaN1',
      'bravoN1',
      'charlieN1',
      'deltaN1',
    ]);
    const { A, B, C, D } = users;
    const { sa, sc, sd } = sockets;

    // ── 시나리오 1: 첫 밤 (DAY → VOTE_SELECT 통과 → EXECUTION no_votes → NIGHT_DOCTOR) ──
    await waitForPhase(events, 'NIGHT_DOCTOR');

    // 의사(D) → A집
    expect(
      (await emitAck(sd, 'enterHouse', { houseId: houseOf(A.userId) })).ok,
    ).toBe(true);

    await waitForPhase(events, 'NIGHT_MAFIA');
    // 마피아(C) → A집
    expect(
      (await emitAck(sc, 'enterHouse', { houseId: houseOf(A.userId) })).ok,
    ).toBe(true);

    await waitForPhase(events, 'NIGHT_POLICE');
    // 경찰(A) → C집 (마피아 조사)
    expect(
      (await emitAck(sa, 'enterHouse', { houseId: houseOf(C.userId) })).ok,
    ).toBe(true);

    await waitForPhase(events, 'NIGHT_RESULT');
    // 보호 매치 → 사망자 없음
    await waitUntil(() => events.nightResultA.length >= 1, 3000, 'nightResult #1');
    expect(events.nightResultA[0]).toEqual({ victimUserId: null });
    // 경찰 결과 — A 본인에게만, isMafia=true
    await waitUntil(
      () => events.policeResultA.length >= 1,
      3000,
      'policeResult #1',
    );
    expect(events.policeResultA[0]).toEqual({
      targetUserId: C.userId,
      isMafia: true,
    });

    // ── 시나리오 2: 다음 사이클 — 보호 실패 ──
    // 다음 DAY → VOTE_SELECT → EXECUTION → NIGHT_DOCTOR (2)
    await waitUntil(
      () => phaseEntries(events, 'NIGHT_DOCTOR').length >= 2,
      15_000,
      '2번째 NIGHT_DOCTOR',
    );

    // 의사(D) → A집 (다른 곳 보호)
    expect(
      (await emitAck(sd, 'enterHouse', { houseId: houseOf(A.userId) })).ok,
    ).toBe(true);

    await waitUntil(
      () => phaseEntries(events, 'NIGHT_MAFIA').length >= 2,
      8000,
      '2번째 NIGHT_MAFIA',
    );
    // 마피아(C) → B집
    expect(
      (await emitAck(sc, 'enterHouse', { houseId: houseOf(B.userId) })).ok,
    ).toBe(true);

    await waitUntil(
      () => phaseEntries(events, 'NIGHT_POLICE').length >= 2,
      8000,
      '2번째 NIGHT_POLICE',
    );
    // 경찰(A) → B집 (시민 조사)
    expect(
      (await emitAck(sa, 'enterHouse', { houseId: houseOf(B.userId) })).ok,
    ).toBe(true);

    await waitUntil(
      () => phaseEntries(events, 'NIGHT_RESULT').length >= 2,
      8000,
      '2번째 NIGHT_RESULT',
    );
    // 보호 실패 → B 사망
    await waitUntil(
      () => events.nightResultA.length >= 2,
      3000,
      'nightResult #2',
    );
    expect(events.nightResultA[1]).toEqual({ victimUserId: B.userId });
    // 경찰 결과 — B 는 시민 → isMafia=false
    await waitUntil(
      () => events.policeResultA.length >= 2,
      3000,
      'policeResult #2',
    );
    expect(events.policeResultA[1]).toEqual({
      targetUserId: B.userId,
      isMafia: false,
    });

    // 시민 수신 차단 검증: B 는 houseEntered / policeResult 단 한 번도 못 받았어야 함
    expect(events.houseEnteredB).toHaveLength(0);
    expect(events.policeResultB).toHaveLength(0);

    // ── 시나리오 3: 다음 낮 — C 처형 → 시민 승 ──
    await waitUntil(
      () => phaseEntries(events, 'DAY_DISCUSSION').length >= 3,
      10_000,
      '3번째 DAY',
    );
    await waitUntil(
      () => phaseEntries(events, 'VOTE_SELECT').length >= 3,
      5000,
      '3번째 VOTE_SELECT',
    );

    // A, D 가 C 에게 (B 는 죽었으니 못 함)
    expect(
      (await emitAck(sa, 'selectVoteTarget', { targetUserId: C.userId })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sd, 'selectVoteTarget', { targetUserId: C.userId })).ok,
    ).toBe(true);

    await waitUntil(
      () => phaseEntries(events, 'VOTE_CONFIRM').length >= 1,
      5000,
      'VOTE_CONFIRM 진입',
    );
    // A, D 모두 찬성 (alive=3, approves=2, total=3 → 4>3 → majority)
    expect(
      (await emitAck(sa, 'confirmExecutionVote', { approve: true })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sd, 'confirmExecutionVote', { approve: true })).ok,
    ).toBe(true);

    // executionResult majority — 이전 사이클(no_votes)이 먼저 들어있으니 reason 으로 필터
    await waitUntil(
      () => events.executionA.some((e) => e.reason === 'majority'),
      8000,
      'majority executionResult',
    );
    const majorityEvent = events.executionA.find((e) => e.reason === 'majority')!;
    expect(majorityEvent.victimUserId).toBe(C.userId);

    await waitUntil(() => events.gameOverA.length >= 1, 8000, 'gameOver');
    const go = events.gameOverA[0];
    expect(go.winnerTeam).toBe('CITIZEN');
    expect(go.players).toHaveLength(4);

    // 시민이 gameOver 는 받음 (룸 브로드캐스트)
    await waitUntil(() => events.gameOverB.length >= 1, 3000, 'gameOver B');

    // ── Prisma INSERT 검증 ──
    // finalizeGame 안의 persistGame 은 async → 폴링으로 row 등장 대기.
    await waitUntil(
      async () => {
        const row = await prisma.game.findFirst({ where: { roomId } });
        return row !== null;
      },
      5000,
      'Game row INSERT',
    );
    const persisted = await prisma.game.findFirst({ where: { roomId } });
    expect(persisted).toBeTruthy();
    expect(persisted!.winnerTeam).toBe('CITIZEN');
    expect(persisted!.startedAt.getTime()).toBeLessThanOrEqual(
      persisted!.endedAt.getTime(),
    );

    const players = await prisma.gamePlayer.findMany({
      where: { gameId: persisted!.id },
    });
    expect(players).toHaveLength(4);
    const byUser = new Map(players.map((p) => [p.userId, p]));
    expect(byUser.get(A.userId)!.role).toBe('POLICE');
    expect(byUser.get(A.userId)!.finalAlive).toBe(true);
    expect(byUser.get(A.userId)!.isWinner).toBe(true);
    expect(byUser.get(B.userId)!.role).toBe('CITIZEN');
    expect(byUser.get(B.userId)!.finalAlive).toBe(false); // 시나리오 2 에서 사망
    expect(byUser.get(B.userId)!.isWinner).toBe(true); // 시민팀 → 승자
    expect(byUser.get(C.userId)!.role).toBe('MAFIA');
    expect(byUser.get(C.userId)!.finalAlive).toBe(false);
    expect(byUser.get(C.userId)!.isWinner).toBe(false);
    expect(byUser.get(D.userId)!.role).toBe('DOCTOR');
    expect(byUser.get(D.userId)!.finalAlive).toBe(true);
    expect(byUser.get(D.userId)!.isWinner).toBe(true);

    cleanup();
  }, 90_000);

  // ─────────────────────────────────────────────────
  // 별도 케이스: 의사 처형 → 다음 밤 NIGHT_DOCTOR skip
  // ─────────────────────────────────────────────────
  it('의사 처형 → 다음 밤 phaseSkipped(NIGHT_DOCTOR) → 3s 후 NIGHT_MAFIA 진입', async () => {
    const { users, sockets, events, cleanup } = await bootGame([
      'alphaN2',
      'bravoN2',
      'charlieN2',
      'deltaN2',
    ]);
    const { D } = users;
    const { sa, sb, sc } = sockets;

    // 첫 밤은 패스 (DAY → VOTE_SELECT no_votes → EXECUTION → NIGHT cycle) — 액션 없이.
    // 둘째 낮의 VOTE_SELECT 에서 의사(D) 를 후보로 만들어 처형.
    await waitUntil(
      () => phaseEntries(events, 'DAY_DISCUSSION').length >= 2,
      15_000,
      '2번째 DAY',
    );
    await waitUntil(
      () => phaseEntries(events, 'VOTE_SELECT').length >= 2,
      5000,
      '2번째 VOTE_SELECT',
    );

    // A, B, C 모두 D 에게 투표 → 후보 D
    expect(
      (await emitAck(sa, 'selectVoteTarget', { targetUserId: D.userId })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sb, 'selectVoteTarget', { targetUserId: D.userId })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sc, 'selectVoteTarget', { targetUserId: D.userId })).ok,
    ).toBe(true);

    await waitUntil(
      () => phaseEntries(events, 'VOTE_CONFIRM').length >= 1,
      5000,
      'VOTE_CONFIRM',
    );
    // 비후보 3명 모두 찬성 → approves=3, total=4 → 6>4 → majority → D 처형
    expect(
      (await emitAck(sa, 'confirmExecutionVote', { approve: true })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sb, 'confirmExecutionVote', { approve: true })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sc, 'confirmExecutionVote', { approve: true })).ok,
    ).toBe(true);

    await waitUntil(
      () => events.executionA.some((e) => e.reason === 'majority'),
      8000,
      'majority executionResult',
    );
    const majorityExec = events.executionA.find((e) => e.reason === 'majority')!;
    expect(majorityExec.victimUserId).toBe(D.userId);

    // 다음 밤 진입 시 NIGHT_DOCTOR 가 skip 되어야 함.
    // EXECUTION 종료 후 phaseSkipped emit (currentPhase 는 NIGHT_DOCTOR 유지하면서 3초 안내).
    await waitUntil(() => events.skipsA.length >= 1, 8000, 'phaseSkipped');
    expect(events.skipsA[0]).toMatchObject({
      skipped: 'NIGHT_DOCTOR',
      reason: 'doctor_dead',
      nextPhase: 'NIGHT_MAFIA',
      noticeMs: 3000,
    });

    // 3초 후 NIGHT_MAFIA 진입
    await waitUntil(
      () => phaseEntries(events, 'NIGHT_MAFIA').length >= 1,
      6000,
      'NIGHT_MAFIA after skip',
    );
    const nm = phaseEntries(events, 'NIGHT_MAFIA')[0];
    expect(nm.nightNumber).toBe(1);

    cleanup();
  }, 90_000);
});
