import BugReportsDashboard from "./BugReportsDashboard";

export const metadata = {
  title: "Bug Review | SeaPals Staff",
  description: "Private SeaPals bug triage and approval workspace.",
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

export default function AdminBugsPage() {
  return <BugReportsDashboard />;
}
