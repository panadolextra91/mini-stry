import { describe, it, expect, vi } from "vitest";
import { setupApproval } from "../../_helpers/in-memory-fakes.js";
import { setupManagerHierarchy } from "../../_helpers/manager-hierarchy-fixture.js";
import { TENANT_A, TENANT_B } from "../../_helpers/tenant-context-fixture.js";
import {
  AjvSchemaValidator,
  autoApprove,
  autoReject,
  requestApproval,
  ruleId,
} from "@/modules/runtime/index.js";
import { userId, tenantContext, roleId, type RoleId } from "@/modules/directory/index.js";
import {
  TaskAlreadyResolvedError,
  UnauthorizedApproverError,
  approvalTaskId,
} from "@/modules/approval/index.js";
import { policyVersionId } from "@/modules/policy/index.js";
import { requestEvaluationId } from "@/modules/request/index.js";

const ACTOR = userId("user_actor");

describe("ApprovalRoutingService", () => {
  const getPolicyContent = (targetRole: RoleId) => ({
    rules: [
      {
        id: ruleId("R1"),
        when: { type: "compare" as const, field: "amount", op: "gt" as const, value: 100 },
        decision: requestApproval(targetRole),
      },
    ],
    defaultDecision: autoReject(),
  });

  it("walk hit: resolves manager and materializes exactly one ApprovalChain + ApprovalTask", async () => {
    const { runtimeService, policyService, chainRepo, taskRepo, userRepo, roleRepo } =
      setupApproval(new AjvSchemaValidator());

    // Setup hierarchy
    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    // Create policy
    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_hit",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    // Submit with requester Hit as the actor in TenantContext
    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterHitId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_hit",
      context: { amount: 200 },
    });

    // Verify evaluation is completed
    expect(result.status).toBe("completed");

    // Retrieve materialized chain
    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain).not.toBeNull();

    // Retrieve materialized task
    const tasks = await taskRepo.findByChainId(TENANT_A, chain!.id);
    expect(tasks.length).toBe(1);
    const task = tasks[0]!;
    expect(task.stageNumber).toBe(1);
    expect(task.state).toBe("PENDING");
    expect(task.approverId).toBe(hierarchy.expectedApproverId);
    expect(task.approverRoleId).toBe(hierarchy.approverRoleId);
  });

  it("walk miss: manager chain ends without target role -> routing failed, no chain, does not throw", async () => {
    const { runtimeService, policyService, chainRepo, userRepo, roleRepo, approvalDispatcher } =
      setupApproval(new AjvSchemaValidator());

    const routingFailedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", routingFailedSpy);

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_miss",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    // Submit with requester Miss as the actor (manager3 has standard role, and managerId is null)
    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterMissId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_miss",
      context: { amount: 200 },
    });

    expect(result.status).toBe("completed"); // Submission does not fail/rollback

    // Verify no chain/task created
    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain).toBeNull();

    // Verify event emitted
    expect(routingFailedSpy).toHaveBeenCalledTimes(1);
    const event = routingFailedSpy.mock.calls[0]![0]!;
    expect(event.evaluationRecordId).toBe(result.id);
    expect(event.reason).toContain("no manager in the chain has the required role");
  });

  it("self-exclusion: requester is excluded from being the approver, walk starts at requester's manager", async () => {
    const { runtimeService, policyService, chainRepo, userRepo, roleRepo, approvalDispatcher } =
      setupApproval(new AjvSchemaValidator());

    const routingFailedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", routingFailedSpy);

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_self",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    // Requester self has approver role, but manager4 has standard role and managerId null.
    // Self-exclusion should start walk at manager4, ending in no holder.
    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterSelfId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_self",
      context: { amount: 200 },
    });

    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain).toBeNull();
    expect(routingFailedSpy).toHaveBeenCalledTimes(1);
    const event = routingFailedSpy.mock.calls[0]![0]!;
    expect(event.reason).toContain("no manager in the chain has the required role");
  });

  it("null requester: null requesterId -> RoutingError thrown and caught, failed event emitted, no chain created", async () => {
    const { runtimeService, policyService, chainRepo, userRepo, roleRepo, approvalDispatcher } =
      setupApproval(new AjvSchemaValidator());

    const routingFailedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", routingFailedSpy);

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_null",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    // Submit with null requester (no actorId in TenantContext)
    const ctx = tenantContext(TENANT_A.tenantId, undefined);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_null",
      context: { amount: 200 },
    });

    expect(result.status).toBe("completed");

    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain).toBeNull();

    expect(routingFailedSpy).toHaveBeenCalledTimes(1);
    const event = routingFailedSpy.mock.calls[0]![0]!;
    expect(event.reason).toBe("no requester");
  });

  it("missing targetRoleId: RoleNotFoundError is thrown and caught, failed event emitted, no chain created", async () => {
    const { runtimeService, policyService, chainRepo, userRepo, roleRepo, approvalDispatcher } =
      setupApproval(new AjvSchemaValidator());

    const routingFailedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", routingFailedSpy);

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);
    const nonExistentRole = roleId("non_existent_role_id");

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_norole",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(nonExistentRole),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterHitId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_norole",
      context: { amount: 200 },
    });

    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain).toBeNull();

    expect(routingFailedSpy).toHaveBeenCalledTimes(1);
    const event = routingFailedSpy.mock.calls[0]![0]!;
    expect(event.reason).toContain("not found in this tenant");
  });

  it("depth cap: manager hops > 50 -> HierarchyTraversalError thrown, failed event emitted", async () => {
    const { runtimeService, policyService, chainRepo, userRepo, roleRepo, approvalDispatcher } =
      setupApproval(new AjvSchemaValidator());

    const routingFailedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", routingFailedSpy);

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_deep",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterDeepId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_deep",
      context: { amount: 200 },
    });

    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain).toBeNull();

    expect(routingFailedSpy).toHaveBeenCalledTimes(1);
    const event = routingFailedSpy.mock.calls[0]![0]!;
    expect(event.reason).toContain("exceeds maximum depth of 50");
  });

  it("idempotency: emitting same evaluationRecordId twice produces only one chain", async () => {
    const { routingService, runtimeService, policyService, chainRepo, userRepo, roleRepo } =
      setupApproval(new AjvSchemaValidator());

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_idempotent",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterHitId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_idempotent",
      context: { amount: 200 },
    });

    // The submit action automatically evaluates and triggers onRequestEvaluated once.
    const chain1 = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain1).not.toBeNull();

    // Triggering onRequestEvaluated manually again
    await routingService.onRequestEvaluated(TENANT_A, {
      tenantId: TENANT_A.tenantId,
      evaluationRecordId: result.id,
      timestamp: Date.now(),
    });

    // Verify it didn't create another chain or error out.
    // The setupApproval wires to in-memory, which just stores things in maps.
    // Let's assert there is still exactly one chain for this request evaluation.
    const chain2 = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain2!.id).toBe(chain1!.id);
  });

  it("ignore non-request-approval decision (auto-approve)", async () => {
    const { runtimeService, policyService, chainRepo, userRepo, roleRepo } = setupApproval(
      new AjvSchemaValidator(),
    );

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_auto",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      {
        rules: [
          {
            id: ruleId("R1"),
            when: { type: "compare" as const, field: "amount", op: "gt" as const, value: 100 },
            decision: autoApprove(),
          },
        ],
        defaultDecision: autoReject(),
      },
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterHitId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_auto",
      context: { amount: 200 },
    });

    expect(result.status).toBe("completed");
    expect(result.decision!.kind).toBe("auto-approve");

    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    expect(chain).toBeNull();
  });

  it("act() APPROVED and REJECTED states, auth guards, immutability, and cross-tenant isolation", async () => {
    const {
      routingService,
      runtimeService,
      policyService,
      chainRepo,
      taskRepo,
      userRepo,
      roleRepo,
      approvalDispatcher,
    } = setupApproval(new AjvSchemaValidator());

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_act",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterHitId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_act",
      context: { amount: 200 },
    });

    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    const tasks = await taskRepo.findByChainId(TENANT_A, chain!.id);
    const task = tasks[0]!;

    // Create a secondary task to cover the branch: t.id !== taskId inside act() mapping
    await taskRepo.create(TENANT_A, {
      chainId: chain!.id,
      stageNumber: 2,
      approverId: userId("another_approver"),
      approverRoleId: roleId("another_role"),
      state: "PENDING",
    });

    // Check cross-tenant isolation: accessing under TENANT_B should return null or empty
    const chainB = await chainRepo.findByRequestEvaluationId(TENANT_B, result.id);
    expect(chainB).toBeNull();
    const tasksB = await taskRepo.findByChainId(TENANT_B, chain!.id);
    expect(tasksB.length).toBe(0);

    // 1. act() by non-approver -> UnauthorizedApproverError
    const unauthorizedCtx = tenantContext(TENANT_A.tenantId, hierarchy.requesterHitId);
    await expect(routingService.act(unauthorizedCtx, task.id, "APPROVE")).rejects.toThrow(
      UnauthorizedApproverError,
    );

    // 2. Immutability: Mutating requester's manager after chain creation should not affect the task approver
    await userRepo.updateManagerId(TENANT_A, hierarchy.requesterHitId, null);
    const updatedRequester = await userRepo.findById(TENANT_A, hierarchy.requesterHitId);
    expect(updatedRequester!.managerId).toBeNull();

    // Verify task approver is still expectedApproverId
    const sameTask = await taskRepo.findById(TENANT_A, task.id);
    expect(sameTask!.approverId).toBe(hierarchy.expectedApproverId);

    // 3. act() APPROVE by correct approver -> success
    const approverCtx = tenantContext(TENANT_A.tenantId, hierarchy.expectedApproverId);
    const approvedSpy = vi.fn();
    approvalDispatcher.on("ApprovalTaskApproved", approvedSpy);

    await routingService.act(approverCtx, task.id, "APPROVE");

    expect(approvedSpy).toHaveBeenCalledTimes(1);
    const approvedEvent = approvedSpy.mock.calls[0]![0]!;
    expect(approvedEvent.taskId).toBe(task.id);

    const resolvedTask = await taskRepo.findById(TENANT_A, task.id);
    expect(resolvedTask!.state).toBe("APPROVED");

    const resolvedChain = await chainRepo.findById(TENANT_A, chain!.id);
    expect(resolvedChain!.status).toBe("IN_PROGRESS");

    // 4. act() on terminal task -> TaskAlreadyResolvedError
    await expect(routingService.act(approverCtx, task.id, "APPROVE")).rejects.toThrow(
      TaskAlreadyResolvedError,
    );
  });

  it("act() REJECTED flow", async () => {
    const {
      routingService,
      runtimeService,
      policyService,
      chainRepo,
      taskRepo,
      userRepo,
      roleRepo,
      approvalDispatcher,
    } = setupApproval(new AjvSchemaValidator());

    const hierarchy = await setupManagerHierarchy(TENANT_A, userRepo, roleRepo);

    const policy = await policyService.createPolicy(TENANT_A, {
      name: "Expense Policy",
      requestType: "expense_reject",
    });
    const draft = await policyService.createDraft(
      TENANT_A,
      policy.id,
      getPolicyContent(hierarchy.approverRoleId),
      ACTOR,
    );
    await policyService.publishDraft(TENANT_A, draft.id);

    const ctx = tenantContext(TENANT_A.tenantId, hierarchy.requesterHitId);
    const result = await runtimeService.submit(ctx, {
      requestType: "expense_reject",
      context: { amount: 200 },
    });

    const chain = await chainRepo.findByRequestEvaluationId(TENANT_A, result.id);
    const tasks = await taskRepo.findByChainId(TENANT_A, chain!.id);
    const task = tasks[0]!;

    const rejectCtx = tenantContext(TENANT_A.tenantId, hierarchy.expectedApproverId);
    const rejectedSpy = vi.fn();
    approvalDispatcher.on("ApprovalTaskRejected", rejectedSpy);

    await routingService.act(rejectCtx, task.id, "REJECT");

    expect(rejectedSpy).toHaveBeenCalledTimes(1);
    const rejectedEvent = rejectedSpy.mock.calls[0]![0]!;
    expect(rejectedEvent.taskId).toBe(task.id);

    const resolvedTask = await taskRepo.findById(TENANT_A, task.id);
    expect(resolvedTask!.state).toBe("REJECTED");

    const resolvedChain = await chainRepo.findById(TENANT_A, chain!.id);
    expect(resolvedChain!.status).toBe("REJECTED");
  });

  it("evaluation not found: onRequestEvaluated with nonexistent evaluationRecordId -> emits routing failed", async () => {
    const { routingService, approvalDispatcher } = setupApproval(new AjvSchemaValidator());
    const failedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", failedSpy);

    await routingService.onRequestEvaluated(TENANT_A, {
      tenantId: TENANT_A.tenantId,
      evaluationRecordId: requestEvaluationId("nonexistent"),
      timestamp: Date.now(),
    });

    expect(failedSpy).toHaveBeenCalledTimes(1);
    expect(failedSpy.mock.calls[0]![0]!.reason).toBe("Evaluation not found");
  });

  it("requester not found: requesterId exists but user not in directory -> emits routing failed", async () => {
    const { routingService, evalRepo, roleRepo, approvalDispatcher } = setupApproval(
      new AjvSchemaValidator(),
    );
    const failedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", failedSpy);

    const r = await roleRepo.create(TENANT_A, { name: "Role r1" });

    const evaluation = await evalRepo.create(TENANT_A, {
      requesterId: userId("nonexistent"),
      requestType: "expense",
      requestInput: { amount: 200 },
      policyVersionId: policyVersionId("v1"),
      decision: requestApproval(r.id),
      trace: [],
      status: "completed",
      errorCode: null,
      fieldPath: null,
    });

    await routingService.onRequestEvaluated(TENANT_A, {
      tenantId: TENANT_A.tenantId,
      evaluationRecordId: evaluation.id,
      timestamp: Date.now(),
    });

    expect(failedSpy).toHaveBeenCalledTimes(1);
    expect(failedSpy.mock.calls[0]![0]!.reason).toBe("requester not found");
  });

  it("manager not found: managerId points to nonexistent user -> emits routing failed", async () => {
    const { routingService, evalRepo, userRepo, roleRepo, approvalDispatcher } = setupApproval(
      new AjvSchemaValidator(),
    );
    const failedSpy = vi.fn();
    approvalDispatcher.on("ApprovalRoutingFailed", failedSpy);

    const r = await roleRepo.create(TENANT_A, { name: "Role" });
    const u = await userRepo.create(TENANT_A, {
      email: "user@test.com",
      name: "User",
      roleId: r.id,
      managerId: userId("nonexistent"),
    });

    const evaluation = await evalRepo.create(TENANT_A, {
      requesterId: u.id,
      requestType: "expense",
      requestInput: { amount: 200 },
      policyVersionId: policyVersionId("v1"),
      decision: requestApproval(r.id),
      trace: [],
      status: "completed",
      errorCode: null,
      fieldPath: null,
    });

    await routingService.onRequestEvaluated(TENANT_A, {
      tenantId: TENANT_A.tenantId,
      evaluationRecordId: evaluation.id,
      timestamp: Date.now(),
    });

    expect(failedSpy).toHaveBeenCalledTimes(1);
    expect(failedSpy.mock.calls[0]![0]!.reason).toContain("manager nonexistent not found");
  });

  it("unexpected error in try block bubbles up", async () => {
    const { routingService, evalRepo } = setupApproval(new AjvSchemaValidator());

    vi.spyOn(evalRepo, "findById").mockRejectedValueOnce(new Error("Unexpected DB Error"));

    await expect(
      routingService.onRequestEvaluated(TENANT_A, {
        tenantId: TENANT_A.tenantId,
        evaluationRecordId: requestEvaluationId("any"),
        timestamp: Date.now(),
      }),
    ).rejects.toThrow("Unexpected DB Error");
  });

  it("act() on nonexistent task throws TaskAlreadyResolvedError", async () => {
    const { routingService } = setupApproval(new AjvSchemaValidator());
    await expect(
      routingService.act(TENANT_A, approvalTaskId("nonexistent"), "APPROVE"),
    ).rejects.toThrow(TaskAlreadyResolvedError);
  });
});
