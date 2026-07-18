import OrdersDashboard from "./OrdersDashboard";

export const metadata = {
  title: "Orders & Fulfillment | SeaPals Staff",
  description: "Private SeaPals order fulfillment workspace.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminOrdersPage() {
  return <OrdersDashboard />;
}
