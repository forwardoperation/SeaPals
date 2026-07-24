import { redirect } from "next/navigation";

export const metadata = {
  title: "Guided Interactive Tutorial | SeaPals TCG",
  description:
    "Learn SeaPals by playing Mr. Easterling's complete guided aquarium lesson.",
};

export default function TutorialPage() {
  redirect("/instructions/tutorial");
}
