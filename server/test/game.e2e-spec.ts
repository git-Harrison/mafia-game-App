// S-server-e2e-full-cycle — 백엔드 1단계 마지막 풀 사이클 E2E.
//
// mafia-app-context.md §5-4 의 "한 사이클" 명세를 한 판으로 확장: 방 생성부터 게임 종료까지
// 모든 standard 이벤트를 한 시나리오 안에서 발화. 회귀 방지 스모크 테스트.
//
// 시드 고정: assignRoles RNG 첫 3호출 [0.5, 0, 0] → A=POLICE, B=CITIZEN, C=MAFIA, D=DOCTOR
//
// 시나리오 (두 사이클):
//   [Cycle 1]
//     DAY_DISCUSSION:
//       - A 가 광장 채팅 → chatMessage 4명 모두 수신
//       - C 가 광장 채팅 시도 (이건 OK — 마피아도 낮 광장 채팅 가능)
//     VOTE_SELECT:
//       - A→B, A→C (vote 변경) — voteCast 2회 (마지막 표 C 만 집계)
//       - B→C, D→C — voteCast 2회 더 → 총 4회, 후보 C 1차 통과
//     VOTE_CONFIRM (candidate=C):
//       - A 찬성, B 반대, D 반대 → approves=1, total=4 → 2 < 4 → no_majority
//     EXECUTION (reason='no_majority', victim=null) — C 생존
//     NIGHT_DOCTOR (nightNumber=1):
//       - D → A의 집 보호 (자기집 보호는 nightNumber===1 만 허용되지만 여기는 타인 보호)
//     NIGHT_MAFIA:
//       - C → B의 집 (마피아 1명 구성 — 그 1명의 타겟이 살해 후보)
//       - C 가 마피아 채팅 1개 — mafiaChat 은 C 본인에게만 (룸 X)
//     NIGHT_POLICE:
//       - A → C의 집 (마피아 조사)
//     NIGHT_RESULT: doctor(A) ≠ mafia(B) → B 사망. policeResult: C 가 마피아 → A 에게만.
//
//   [Cycle 2] (alive: A, C, D)
//     DAY_DISCUSSION (자동 진입 — 머신 루프 검증)
//     VOTE_SELECT: A→C, D→C → 후보 C
//     VOTE_CONFIRM: A 찬성, D 찬성 → approves=2, total=3 (B 죽음 제외) → 4 > 3 → majority
//     EXECUTION (reason='majority', victim=C) — C 사망 → 시민팀 승 → gameOver
//
//   검증 후: Prisma Game/GamePlayer 영속 row 확인.
//
// 카피·닉네임 자체 작성. 이벤트명·에러코드는 기능 서술형 — design-policy §2 IP 회피.
// 페이즈 env 1s 단축, EXECUTION 3s 고정. 총 런타임 약 25s.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GAME_RNG } from '../src/game/tokens';

describe('S-server-e2e-full-cycle — 한 게임 처음부터 끝까지', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  const originalEnv: Record<string, string | undefined> = {};

  // assignRoles(4) 첫 3개 [0.5, 0, 0] → [POLICE, CITIZEN, MAFIA, DOCTOR]
  // 그 외는 0 — 집 슬롯 셔플 등 결정성 유지.
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

  async function waitUntil(
    cond: () => boolean | Promise<boolean>,
    timeoutMs: number,
    label: string,
  ): Promise<void> {
    const start = Date.now();
    while (true) {
      if (await cond()) return;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`waitUntil(${label}) timeout`);
      }
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  it('한 판 풀 사이클 — 사이클 1 no_majority → 밤 사망 → 사이클 2 majority → 시민 승 + Prisma 영속화', async () => {
    // ─── 1) 게스트 4명 + 소켓 연결 ─────────────────────
    const A = await newGuest('alphaFC');
    const B = await newGuest('bravoFC');
    const C = await newGuest('charlieFC');
    const D = await newGuest('deltaFC');
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

    // listener 등록 — startGame 직후 emit 되는 이벤트들을 놓치지 않게 미리.
    const assignA = collect<any>(sa, 'assignRoles');
    const assignB = collect<any>(sb, 'assignRoles');
    const assignC = collect<any>(sc, 'assignRoles');
    const assignD = collect<any>(sd, 'assignRoles');
    const housesA = collect<any>(sa, 'housesAssigned');
    const housesB = collect<any>(sb, 'housesAssigned');
    const housesC = collect<any>(sc, 'housesAssigned');
    const housesD = collect<any>(sd, 'housesAssigned');
    const phasesA = collect<any>(sa, 'phaseChanged');
    const phasesB = collect<any>(sb, 'phaseChanged');
    const phasesD = collect<any>(sd, 'phaseChanged');
    const chatA = collect<any>(sa, 'chatMessage');
    const chatB = collect<any>(sb, 'chatMessage');
    const chatC = collect<any>(sc, 'chatMessage');
    const chatD = collect<any>(sd, 'chatMessage');
    const mafiaChatA = collect<any>(sa, 'mafiaChat');
    const mafiaChatB = collect<any>(sb, 'mafiaChat');
    const mafiaChatC = collect<any>(sc, 'mafiaChat');
    const mafiaChatD = collect<any>(sd, 'mafiaChat');
    const voteCastA = collect<any>(sa, 'voteCast');
    const voteCastB = collect<any>(sb, 'voteCast');
    const executionA = collect<any>(sa, 'executionResult');
    const executionB = collect<any>(sb, 'executionResult');
    const houseEnteredA = collect<any>(sa, 'houseEntered');
    const houseEnteredB = collect<any>(sb, 'houseEntered');
    const houseEnteredC = collect<any>(sc, 'houseEntered');
    const houseEnteredD = collect<any>(sd, 'houseEntered');
    const nightResultA = collect<any>(sa, 'nightResult');
    const nightResultB = collect<any>(sb, 'nightResult');
    const policeResultA = collect<any>(sa, 'policeResult');
    const policeResultB = collect<any>(sb, 'policeResult');
    const policeResultC = collect<any>(sc, 'policeResult');
    const policeResultD = collect<any>(sd, 'policeResult');
    const gameOverA = collect<any>(sa, 'gameOver');
    const gameOverB = collect<any>(sb, 'gameOver');
    const gameOverC = collect<any>(sc, 'gameOver');
    const gameOverD = collect<any>(sd, 'gameOver');

    // ─── 2) 방 생성 + 입장 + ready + startGame ─────────
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

    // ─── 3) 직업·집 배정 검증 ──────────────────────────
    await waitUntil(
      () =>
        assignA.length === 1 &&
        assignB.length === 1 &&
        assignC.length === 1 &&
        assignD.length === 1 &&
        housesA.length === 1 &&
        housesB.length === 1 &&
        housesC.length === 1 &&
        housesD.length === 1,
      5000,
      'assignRoles + housesAssigned (4명)',
    );
    expect(assignA[0].role).toBe('POLICE');
    expect(assignB[0].role).toBe('CITIZEN');
    expect(assignC[0].role).toBe('MAFIA');
    expect(assignD[0].role).toBe('DOCTOR');
    expect(assignC[0].mafiaAllies).toEqual([C.userId]);
    expect(assignA[0].mafiaAllies).toBeUndefined();
    expect(housesA[0].map).toHaveLength(4);
    expect(housesA[0].houses).toHaveLength(8);

    const houseOf = (userId: string): string => {
      const m = housesA[0].map.find((x: any) => x.userId === userId)!;
      return m.houseId;
    };

    // ─── 4) Cycle 1 — DAY_DISCUSSION 채팅 ──────────────
    await waitUntil(
      () => phasesA.some((p) => p.phase === 'DAY_DISCUSSION'),
      3000,
      'DAY_DISCUSSION (cycle 1)',
    );
    expect((await emitAck(sa, 'sendChatMessage', { text: 'morning everyone' })).ok).toBe(
      true,
    );
    await waitUntil(
      () =>
        chatA.length === 1 &&
        chatB.length === 1 &&
        chatC.length === 1 &&
        chatD.length === 1,
      3000,
      'chatMessage 룸 브로드캐스트',
    );
    expect(chatA[0].text).toBe('morning everyone');
    expect(chatA[0].from).toBe(A.userId);

    // ─── 5) Cycle 1 — VOTE_SELECT (vote 변경 검증 포함) ─
    await waitUntil(
      () => phasesA.some((p) => p.phase === 'VOTE_SELECT'),
      5000,
      'VOTE_SELECT (cycle 1)',
    );
    // A→B 후 A→C 로 변경 (마지막만 집계)
    expect(
      (await emitAck(sa, 'selectVoteTarget', { targetUserId: B.userId })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sa, 'selectVoteTarget', { targetUserId: C.userId })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sb, 'selectVoteTarget', { targetUserId: C.userId })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sd, 'selectVoteTarget', { targetUserId: C.userId })).ok,
    ).toBe(true);
    // voteCast 룸 풀 공개 — A·B 모두 4번 받음 (A 변경 2 + B + D)
    await waitUntil(
      () => voteCastA.length >= 4 && voteCastB.length >= 4,
      3000,
      'voteCast x4',
    );
    expect(voteCastA.slice(0, 4).map((v) => v.targetUserId)).toEqual([
      B.userId,
      C.userId,
      C.userId,
      C.userId,
    ]);

    // ─── 6) Cycle 1 — VOTE_CONFIRM no_majority ─────────
    await waitUntil(
      () => phasesA.some((p) => p.phase === 'VOTE_CONFIRM'),
      5000,
      'VOTE_CONFIRM (cycle 1)',
    );
    // 후보 C 본인의 confirm 은 자동 반대 1표 + 본인 emit 거부 (5단계 룰 1)
    expect((await emitAck(sa, 'confirmExecutionVote', { approve: true })).ok).toBe(true);
    expect((await emitAck(sb, 'confirmExecutionVote', { approve: false })).ok).toBe(
      true,
    );
    expect((await emitAck(sd, 'confirmExecutionVote', { approve: false })).ok).toBe(
      true,
    );
    // C 본인 시도 → CANDIDATE_CANNOT_VOTE
    const candidateVote = await emitAck(sc, 'confirmExecutionVote', { approve: true });
    expect(candidateVote.ok).toBe(false);
    expect(candidateVote.error).toBe('CANDIDATE_CANNOT_VOTE');

    // ─── 7) Cycle 1 — EXECUTION no_majority ────────────
    await waitUntil(
      () => executionA.length >= 1,
      8000,
      'executionResult #1',
    );
    expect(executionA[0]).toEqual({ reason: 'no_majority', victimUserId: null });

    // ─── 8) Cycle 1 — NIGHT_DOCTOR + 의사 액션 ─────────
    await waitUntil(
      () => phasesA.some((p) => p.phase === 'NIGHT_DOCTOR'),
      5000,
      'NIGHT_DOCTOR (cycle 1)',
    );
    expect(
      (await emitAck(sd, 'enterHouse', { houseId: houseOf(A.userId) })).ok,
    ).toBe(true);
    // houseEntered 는 의사 본인(D)에게만
    await waitUntil(
      () => houseEnteredD.length >= 1,
      3000,
      'houseEntered D@DOCTOR',
    );
    expect(houseEnteredA).toHaveLength(0);
    expect(houseEnteredB).toHaveLength(0);
    expect(houseEnteredC).toHaveLength(0);

    // ─── 9) Cycle 1 — NIGHT_MAFIA + 마피아 액션 + 채팅 ──
    await waitUntil(
      () => phasesA.some((p) => p.phase === 'NIGHT_MAFIA'),
      5000,
      'NIGHT_MAFIA (cycle 1)',
    );
    // 마피아 채팅 — C 본인에게만 emit (룸 X)
    expect(
      (await emitAck(sc, 'sendMafiaChat', { text: 'targeting tonight' })).ok,
    ).toBe(true);
    await waitUntil(
      () => mafiaChatC.length >= 1,
      3000,
      'mafiaChat to MAFIA only',
    );
    expect(mafiaChatA).toHaveLength(0);
    expect(mafiaChatB).toHaveLength(0);
    expect(mafiaChatD).toHaveLength(0);

    // 비마피아(B) 가 sendMafiaChat → FORBIDDEN
    const bMafiaTry = await emitAck(sb, 'sendMafiaChat', { text: 'sneak' });
    expect(bMafiaTry.ok).toBe(false);
    expect(bMafiaTry.error).toBe('FORBIDDEN');

    expect(
      (await emitAck(sc, 'enterHouse', { houseId: houseOf(B.userId) })).ok,
    ).toBe(true);
    // houseEntered 는 살아있는 마피아 전원 — 여기는 C 하나
    await waitUntil(
      () => houseEnteredC.length >= 1,
      3000,
      'houseEntered C@MAFIA',
    );

    // ─── 10) Cycle 1 — NIGHT_POLICE + 경찰 액션 ────────
    await waitUntil(
      () => phasesA.some((p) => p.phase === 'NIGHT_POLICE'),
      5000,
      'NIGHT_POLICE (cycle 1)',
    );
    expect(
      (await emitAck(sa, 'enterHouse', { houseId: houseOf(C.userId) })).ok,
    ).toBe(true);
    await waitUntil(
      () => houseEnteredA.length >= 1,
      3000,
      'houseEntered A@POLICE',
    );

    // ─── 11) Cycle 1 — NIGHT_RESULT (B 사망) + policeResult ─
    await waitUntil(
      () => phasesA.some((p) => p.phase === 'NIGHT_RESULT'),
      5000,
      'NIGHT_RESULT (cycle 1)',
    );
    await waitUntil(
      () => nightResultA.length >= 1 && nightResultB.length >= 1,
      3000,
      'nightResult 룸 브로드캐스트',
    );
    expect(nightResultA[0]).toEqual({ victimUserId: B.userId });
    // policeResult 는 A 본인에게만, isMafia=true
    await waitUntil(
      () => policeResultA.length >= 1,
      3000,
      'policeResult to A',
    );
    expect(policeResultA[0]).toEqual({ targetUserId: C.userId, isMafia: true });
    expect(policeResultB).toHaveLength(0);
    expect(policeResultC).toHaveLength(0);
    expect(policeResultD).toHaveLength(0);

    // ─── 12) Cycle 2 — 머신 루프: NIGHT_RESULT → DAY_DISCUSSION ─
    await waitUntil(
      () => phasesA.filter((p) => p.phase === 'DAY_DISCUSSION').length >= 2,
      8000,
      '2번째 DAY_DISCUSSION (머신 루프)',
    );
    // B 는 사망 상태로 phaseChanged 수신 계속 (관전자)
    expect(phasesB.filter((p) => p.phase === 'DAY_DISCUSSION').length).toBeGreaterThanOrEqual(2);

    await waitUntil(
      () => phasesA.filter((p) => p.phase === 'VOTE_SELECT').length >= 2,
      5000,
      '2번째 VOTE_SELECT',
    );
    // 살아있는 A, D 가 C 에게 투표 (B 죽음 → 투표 불가)
    expect(
      (await emitAck(sa, 'selectVoteTarget', { targetUserId: C.userId })).ok,
    ).toBe(true);
    expect(
      (await emitAck(sd, 'selectVoteTarget', { targetUserId: C.userId })).ok,
    ).toBe(true);
    // B(사망자) 시도 → DEAD
    const deadVote = await emitAck(sb, 'selectVoteTarget', { targetUserId: C.userId });
    expect(deadVote.ok).toBe(false);
    expect(deadVote.error).toBe('DEAD');

    // ─── 13) Cycle 2 — VOTE_CONFIRM majority → C 사망 → gameOver ─
    // 주의: cycle 1 에서 이미 VOTE_CONFIRM 1번 발생 → >=2 로 카운트.
    await waitUntil(
      () => phasesA.filter((p) => p.phase === 'VOTE_CONFIRM').length >= 2,
      5000,
      '2번째 VOTE_CONFIRM',
    );
    expect((await emitAck(sa, 'confirmExecutionVote', { approve: true })).ok).toBe(true);
    expect((await emitAck(sd, 'confirmExecutionVote', { approve: true })).ok).toBe(true);

    await waitUntil(
      () => executionA.some((e) => e.reason === 'majority'),
      8000,
      'executionResult majority',
    );
    const majorityEv = executionA.find((e) => e.reason === 'majority')!;
    expect(majorityEv.victimUserId).toBe(C.userId);

    // ─── 14) gameOver 룸 브로드캐스트 (살아있는·죽은 전원 수신) ─
    await waitUntil(
      () =>
        gameOverA.length >= 1 &&
        gameOverB.length >= 1 &&
        gameOverC.length >= 1 &&
        gameOverD.length >= 1,
      5000,
      'gameOver to all 4 sockets',
    );
    expect(gameOverA[0].winnerTeam).toBe('CITIZEN');
    expect(gameOverA[0].players).toHaveLength(4);
    const winners = new Map(
      gameOverA[0].players.map((p: any) => [p.userId, p.isWinner] as const),
    );
    expect(winners.get(A.userId)).toBe(true); // POLICE
    expect(winners.get(B.userId)).toBe(true); // CITIZEN (사망했지만 팀 승)
    expect(winners.get(C.userId)).toBe(false); // MAFIA
    expect(winners.get(D.userId)).toBe(true); // DOCTOR

    // ─── 15) Prisma 영속화 검증 ────────────────────────
    await waitUntil(
      async () => {
        const row = await prisma.game.findFirst({ where: { roomId } });
        return row !== null;
      },
      5000,
      'Prisma Game row INSERT',
    );
    const persistedGame = await prisma.game.findFirst({ where: { roomId } });
    expect(persistedGame).toBeTruthy();
    expect(persistedGame!.winnerTeam).toBe('CITIZEN');
    expect(persistedGame!.startedAt.getTime()).toBeLessThanOrEqual(
      persistedGame!.endedAt.getTime(),
    );

    const players = await prisma.gamePlayer.findMany({
      where: { gameId: persistedGame!.id },
    });
    expect(players).toHaveLength(4);
    const byUser = new Map(players.map((p) => [p.userId, p]));
    expect(byUser.get(A.userId)!.role).toBe('POLICE');
    expect(byUser.get(A.userId)!.finalAlive).toBe(true);
    expect(byUser.get(A.userId)!.isWinner).toBe(true);
    expect(byUser.get(B.userId)!.role).toBe('CITIZEN');
    expect(byUser.get(B.userId)!.finalAlive).toBe(false); // cycle 1 밤에 사망
    expect(byUser.get(B.userId)!.isWinner).toBe(true);
    expect(byUser.get(C.userId)!.role).toBe('MAFIA');
    expect(byUser.get(C.userId)!.finalAlive).toBe(false);
    expect(byUser.get(C.userId)!.isWinner).toBe(false);
    expect(byUser.get(D.userId)!.role).toBe('DOCTOR');
    expect(byUser.get(D.userId)!.finalAlive).toBe(true);
    expect(byUser.get(D.userId)!.isWinner).toBe(true);

    // ─── 16) 페이즈 시퀀스 정합성 (양적 검증) ──────────
    // Cycle 1 + Cycle 2 의 phaseChanged 시퀀스 검증.
    // Cycle 1: DAY → VOTE_SELECT → VOTE_CONFIRM → EXECUTION → NIGHT_DOCTOR → NIGHT_MAFIA → NIGHT_POLICE → NIGHT_RESULT (8)
    // Cycle 2: DAY → VOTE_SELECT → VOTE_CONFIRM → EXECUTION (4)
    // EXECUTION cycle 2 직후 gameOver → DAY 재진입 없음. 총 12.
    const seq = phasesA.slice(0, 12).map((p) => p.phase);
    expect(seq).toEqual([
      'DAY_DISCUSSION',
      'VOTE_SELECT',
      'VOTE_CONFIRM',
      'EXECUTION',
      'NIGHT_DOCTOR',
      'NIGHT_MAFIA',
      'NIGHT_POLICE',
      'NIGHT_RESULT',
      'DAY_DISCUSSION',
      'VOTE_SELECT',
      'VOTE_CONFIRM',
      'EXECUTION',
    ]);
    // nightNumber 는 밤 페이즈만 포함
    expect(phasesA.find((p) => p.phase === 'NIGHT_DOCTOR')!.nightNumber).toBe(1);
    expect(phasesA.find((p) => p.phase === 'NIGHT_RESULT')!.nightNumber).toBe(1);
    expect(phasesA.find((p) => p.phase === 'DAY_DISCUSSION')!.nightNumber).toBeUndefined();

    // ─── cleanup ──────────────────────────────────────
    for (const s of [sa, sb, sc, sd]) s.disconnect();
  }, 90_000);
});
