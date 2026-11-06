
import Image from "next/image";

type DestinationCardProps = {
  name: string;
  location: string;
  image: string;
};

export default function DestinationCard({
  name,
  location,
  image,
}: DestinationCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <Image
        src={image}
        alt={name}
        width={600}
        height={400}
        className="h-48 w-full object-cover"
      />

      <div className="p-5">
        <h2 className="text-xl font-semibold">{name}</h2>
        <p className="mt-2 text-gray-500">{location}</p>
      </div>
    </div>
  );
}

