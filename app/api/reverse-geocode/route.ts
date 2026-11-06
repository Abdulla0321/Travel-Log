
import { NextResponse } from "next/server";

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/reverse";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  // 1. Validate that both coordinates are provided.
  if (
    lat === null ||
    lon === null ||
    !lat.trim() ||
    !lon.trim()
  ) {
    return NextResponse.json(
      { error: "Latitude and longitude are required." },
      { status: 400 }
    );
  }

  const latitude = Number(lat);
  const longitude = Number(lon);

  // 2. Validate coordinate formats and geographic boundaries.
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      { error: "Invalid coordinates." },
      { status: 400 }
    );
  }

  try {
    // 3. Build the Nominatim reverse-geocoding request.
    const url = new URL(NOMINATIM_URL);

    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "14");

    // 4. Request the location details.
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "TravelLogbook/1.0",
        "Accept-Language": "en",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    // 5. Handle errors returned by Nominatim.
    if (!response.ok) {
      console.error(
        "Nominatim request failed with status:",
        response.status
      );

      return NextResponse.json(
        {
          error: "Location lookup is temporarily unavailable.",
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    // 6. Handle successful requests with no usable location data.
    if (
      !data ||
      typeof data.display_name !== "string" ||
      !data.display_name.trim() ||
      !data.address ||
      typeof data.address !== "object"
    ) {
      return NextResponse.json(
        {
          error: "No location details found for these coordinates.",
        },
        { status: 404 }
      );
    }

    // 7. Return normalized location information to the frontend.
    return NextResponse.json({
      displayName: data.display_name,
      name: data.name ?? "",
      address: data.address,
    });
  } catch (error) {
    console.error("Reverse geocoding request failed:", error);

    return NextResponse.json(
      {
        error: "Could not retrieve location information.",
      },
      { status: 502 }
    );
  }
}
