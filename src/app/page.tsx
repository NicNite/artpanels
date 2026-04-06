import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">ArtPanels</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Design translucent art panels for your windows.</CardDescription>
        </CardHeader>
      </Card>
      <Button className="mt-4">Get Started</Button>
    </main>
  );
}
