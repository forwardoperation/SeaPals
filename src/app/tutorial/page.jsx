import { redirect } from "next/navigation";

export const metadata = {
  title: "Guided Interactive Tutorial | SeaRealm TCG",
  description:
    "Learn SeaRealm by playing Mr. Easterling's complete guided aquarium lesson.",
  alternates: { canonical: "/instructions/tutorial" },
};

export default function TutorialPage() {
  redirect("/instructions/tutorial");
}
