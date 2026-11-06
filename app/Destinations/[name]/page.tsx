import Image from "next/image";
import { destinations } from "../../data/destinations";

type DestinationPageProps = {
  params: Promise<{
    name: string;
  }>;
};

export default async function DestinationPage({
  params,
}: DestinationPageProps) {
  const { name } = await params;

  const destination = destinations.find(
    (destination) =>
      destination.name.toLowerCase() === name.toLowerCase()
  );

  if (!destination) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <section className="mx-auto max-w-5xl px-8 py-16">
          <h1 className="text-4xl font-bold">
            Destination not found
          </h1>

          <p className="mt-4 text-gray-600">
            We couldn&apos;t find the destination you&apos;re looking for.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="mx-auto max-w-5xl px-8 py-16">
        <p className="text-sm font-medium text-gray-500">
          Destination
        </p>

        <h1 className="mt-2 text-5xl font-bold">
          {destination.name}
        </h1>

        <p className="mt-3 text-lg text-gray-500">
          {destination.location}
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl">
  <Image
    src={destination.image}
    alt={destination.name}
    width={1200}
    height={600}
    className="h-80 w-full object-cover"
  />
</div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold">
            Destination Logbook
          </h2>

          <p className="mt-4 max-w-2xl text-gray-600">
            This is where travellers will share their experiences,
            observations, and useful information about this destination.
          </p>
        </div>
      </section>
    </main>
  );
}