import { describe, it, expect } from "vitest";
import { tenantContext, tenantId, userId, roleId } from "@/modules/directory/index.js";
import { requestEvaluationId } from "@/modules/request/index.js";
import {
  approvalChainId,
  approvalTaskId,
  InMemoryApprovalChainRepository,
  InMemoryApprovalTaskRepository,
  RoutingError,
  HierarchyTraversalError,
  TaskAlreadyResolvedError,
  UnauthorizedApproverError,
} from "@/modules/approval/index.js";

const TENANT_A = tenantContext(tenantId("tenant_a"));
const TENANT_B = tenantContext(tenantId("tenant_b"));

describe("approval repository and domain components", () => {
  describe("ids", () => {
    it("brands string IDs correctly", () => {
      const chainId = approvalChainId("c1");
      const taskId = approvalTaskId("t1");
      expect(chainId).toBe("c1");
      expect(taskId).toBe("t1");
    });
  });

  describe("errors", () => {
    it("RoutingError carries requesterId and targetRoleId", () => {
      const reqId = userId("u1");
      const rId = roleId("r1");
      const err = new RoutingError(reqId, rId);
      expect(err.requesterId).toBe(reqId);
      expect(err.targetRoleId).toBe(rId);
      expect(err.name).toBe("RoutingError");
    });

    it("HierarchyTraversalError is defined", () => {
      const err = new HierarchyTraversalError();
      expect(err.name).toBe("HierarchyTraversalError");
    });

    it("TaskAlreadyResolvedError carries taskId", () => {
      const taskId = approvalTaskId("t1");
      const err = new TaskAlreadyResolvedError(taskId);
      expect(err.taskId).toBe(taskId);
      expect(err.name).toBe("TaskAlreadyResolvedError");
    });

    it("UnauthorizedApproverError is defined", () => {
      const err = new UnauthorizedApproverError();
      expect(err.name).toBe("UnauthorizedApproverError");
    });
  });

  describe("InMemoryApprovalChainRepository", () => {
    it("creates, finds, and updates status", async () => {
      const repo = new InMemoryApprovalChainRepository();
      const reqEvalId = requestEvaluationId("eval_1");

      const created = await repo.create(TENANT_A, {
        requestEvaluationId: reqEvalId,
        status: "IN_PROGRESS",
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe("IN_PROGRESS");
      expect(created.tenantId).toBe(TENANT_A.tenantId);

      const found = await repo.findById(TENANT_A, created.id);
      expect(found).toEqual(created);

      const foundByEval = await repo.findByRequestEvaluationId(TENANT_A, reqEvalId);
      expect(foundByEval).toEqual(created);

      const updated = await repo.updateStatus(TENANT_A, created.id, "APPROVED");
      expect(updated.status).toBe("APPROVED");

      const foundAfterUpdate = await repo.findById(TENANT_A, created.id);
      expect(foundAfterUpdate!.status).toBe("APPROVED");
    });

    it("enforces tenant isolation (CON-01)", async () => {
      const repo = new InMemoryApprovalChainRepository();
      const created = await repo.create(TENANT_A, {
        requestEvaluationId: requestEvaluationId("eval_1"),
        status: "IN_PROGRESS",
      });

      // Tenant B cannot read Tenant A's chain
      const foundByB = await repo.findById(TENANT_B, created.id);
      expect(foundByB).toBeNull();

      const foundByEvalB = await repo.findByRequestEvaluationId(
        TENANT_B,
        requestEvaluationId("eval_1"),
      );
      expect(foundByEvalB).toBeNull();

      await expect(repo.updateStatus(TENANT_B, created.id, "APPROVED")).rejects.toThrow();
    });

    it("returns null or throws error for nonexistent chain", async () => {
      const repo = new InMemoryApprovalChainRepository();
      const nonExistentId = approvalChainId("nonexistent");

      const found = await repo.findById(TENANT_A, nonExistentId);
      expect(found).toBeNull();

      await expect(repo.updateStatus(TENANT_A, nonExistentId, "APPROVED")).rejects.toThrow(
        "not found in this tenant",
      );
    });
  });

  describe("InMemoryApprovalTaskRepository", () => {
    it("creates, finds, and updates state", async () => {
      const repo = new InMemoryApprovalTaskRepository();
      const chainId = approvalChainId("chain_1");
      const approver = userId("u1");
      const approverRole = roleId("r1");

      const created = await repo.create(TENANT_A, {
        chainId,
        stageNumber: 1,
        approverId: approver,
        approverRoleId: approverRole,
        state: "PENDING",
      });

      expect(created.id).toBeDefined();
      expect(created.state).toBe("PENDING");
      expect(created.tenantId).toBe(TENANT_A.tenantId);

      const found = await repo.findById(TENANT_A, created.id);
      expect(found).toEqual(created);

      const foundByChain = await repo.findByChainId(TENANT_A, chainId);
      expect(foundByChain).toHaveLength(1);
      expect(foundByChain[0]).toEqual(created);

      const foundByApprover = await repo.findByApprover(TENANT_A, approver);
      expect(foundByApprover).toHaveLength(1);
      expect(foundByApprover[0]).toEqual(created);

      const updated = await repo.updateState(TENANT_A, created.id, "APPROVED");
      expect(updated.state).toBe("APPROVED");

      const foundAfterUpdate = await repo.findById(TENANT_A, created.id);
      expect(foundAfterUpdate!.state).toBe("APPROVED");
    });

    it("enforces tenant isolation (CON-01)", async () => {
      const repo = new InMemoryApprovalTaskRepository();
      const created = await repo.create(TENANT_A, {
        chainId: approvalChainId("chain_1"),
        stageNumber: 1,
        approverId: userId("u1"),
        approverRoleId: roleId("r1"),
        state: "PENDING",
      });

      // Tenant B cannot read Tenant A's task
      const foundByB = await repo.findById(TENANT_B, created.id);
      expect(foundByB).toBeNull();

      const foundByChainB = await repo.findByChainId(TENANT_B, approvalChainId("chain_1"));
      expect(foundByChainB).toHaveLength(0);

      await expect(repo.updateState(TENANT_B, created.id, "APPROVED")).rejects.toThrow();
    });

    it("returns null or throws error for nonexistent task", async () => {
      const repo = new InMemoryApprovalTaskRepository();
      const nonExistentId = approvalTaskId("nonexistent");

      const found = await repo.findById(TENANT_A, nonExistentId);
      expect(found).toBeNull();

      await expect(repo.updateState(TENANT_A, nonExistentId, "APPROVED")).rejects.toThrow(
        "not found in this tenant",
      );
    });
  });
});
