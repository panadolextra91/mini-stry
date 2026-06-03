# Phase 5 Plan 2 Summary

Con xin báo cáo kết quả thực hiện kế hoạch `05-02-PLAN.md` cho mẹ iu như sau:

## 1. Kết quả thực hiện (What was done)

- **ApprovalRoutingService**: Triển khai toàn bộ nghiệp vụ định tuyến duyệt phép tự động dựa trên reporting line (manager hierarchy):
  - Hỗ trợ cơ chế kiểm tra trùng lặp (idempotency) thông qua `chainRepo.findByRequestEvaluationId`.
  - Chặn các quyết định không yêu cầu duyệt (`auto-approve`/`auto-reject`).
  - Chặn yêu cầu null requester (`requesterId === null`) trước khi gọi repository để đảm bảo an toàn kiểu dữ liệu.
  - Xác thực Role tồn tại trong registry, ném `RoleNotFoundError` nếu thiếu.
  - Duyệt manager chain (không tính chính requester), giới hạn tối đa 50 hops, nếu vượt quá ném `HierarchyTraversalError`.
  - Thiết kế try/catch bao bọc toàn bộ thân hàm `onRequestEvaluated` giúp chuyển hóa mọi Routing/Role/Hierarchy error thành event `ApprovalRoutingFailed` và không rethrow để bảo vệ dữ liệu Request Evaluation đã lưu trữ (D-54).
  - Triển khai hàm điều khiển máy trạng thái `act()` hỗ trợ Approve/Reject task kèm các auth guards (`UnauthorizedApproverError`) và terminal task guards (`TaskAlreadyResolvedError`).
- **ApprovalAuditSubscriber**: Lắng nghe các event duyệt phép để ghi log audit theo cấu trúc by-reference (`approval.task_approved`, `approval.task_rejected`, `approval.routing_failed`), cam kết không lộ nội dung request/decision (D-37/D-53).
- **Convex Adapters & Schema**:
  - Mở rộng bảng `requestEvaluations` với cột `requesterId` (nullable cho tính tương thích ngược).
  - Thêm bảng `approvalChains` (index `by_tenant_created`, `by_tenant_request_evaluation`).
  - Thêm bảng `approvalTasks` (index `by_tenant_chain`, `by_tenant_approver`).
  - Triển khai repo `ConvexApprovalChainRepository` và `ConvexApprovalTaskRepository` cùng mappers.
  - Tích hợp DI và wire event tại file composition root `convex/request.ts`, bổ sung đối số `actorId` cho mutation `submitRequest` mà không mang bất kỳ domain logic nào vào lớp Convex.
  - Thực hiện sync schema Convex thành công lên môi trường dev nội bộ (`npx convex dev --once`).
- **Test coverage**:
  - Viết đầy đủ test suite cho `ApprovalRoutingService` và `ApprovalAuditSubscriber`.
  - Cấu hình ghim tỷ lệ bao phủ của toàn bộ module `approval` (domain + application + memory adapters) đạt **100%**.

## 2. Kết quả kiểm thử & Phân tích tác động (Validation)

- **TypeScript & Linter**: Biên dịch thành công 100% không cảnh báo, linter sạch.
- **Vitest**: Toàn bộ 219/219 bài kiểm thử đều đã pass xanh.
- **Kiến trúc Hexagonal**: Đảm bảo module `request` không có bất kỳ import hay phụ thuộc biên dịch nào tới module `approval` (SC#1).
