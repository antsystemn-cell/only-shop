import LocalOrdersTab from "./orders/LocalOrdersTab";

export default function Orders() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Захиалга удирдах</h1>
        <p className="text-muted-foreground mt-1">Бүх захиалгуудыг нэг дороос харах, удирдах</p>
      </div>
      <LocalOrdersTab />
    </div>
  );
}
