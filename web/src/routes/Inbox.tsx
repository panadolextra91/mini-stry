import { InboxList } from "../features/inbox/InboxList";

export function Inbox() {
  return (
    <div className="flex flex-col h-full bg-background p-8">
      <h1 className="text-[28px] font-semibold leading-[60px] mb-6">Personal Inbox</h1>
      <div className="flex-1 overflow-hidden">
        <InboxList />
      </div>
    </div>
  );
}
