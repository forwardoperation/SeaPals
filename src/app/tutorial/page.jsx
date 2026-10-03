import { redirect } from "next/navigation";

export const metadata = {
  title: "Guided Interactive Tutorial | SeaRealm TCG",
  description:
    "Learn SeaRealm with Mr. Easterling's guided simulator lessons.",
  alternates: { canonical: "/instructions/tutorial" },
};

export default function TutorialPage() {
  redirect("/instructions/tutorial");
}
