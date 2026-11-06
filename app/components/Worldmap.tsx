
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  Marker,
  NavigationControl,
  Popup,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "../../utils/supabase/client";

type LogbookEntry = {
  id: string;
  text: string;
  timestamp: string;
  photos?: string[];
};

type LocationContext = {
  displayName: string;
  name: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  district?: string;
  state?: string;
  country?: string;
};

type Logbook = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  locationContext?: LocationContext;
  entries: LogbookEntry[];
};

type SupabaseLogbook = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
  location_context: LocationContext | null;
};

function convertSupabaseLogbook(row: SupabaseLogbook): Logbook {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    locationContext: row.location_context ?? undefined,
    entries: [],
  };
}

export default function WorldMap() {
  const supabase = useMemo(() => createClient(), []);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const popup = useRef<Popup | null>(null);
  const logbooksRef = useRef<Logbook[]>([]);
  const mountedRef = useRef(false);

  const [isPointing, setIsPointing] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [logbookName, setLogbookName] = useState("");
  const [pointedCoordinates, setPointedCoordinates] = useState({
    latitude: 20,
    longitude: 0,
  });
  const [locationContext, setLocationContext] =
    useState<LocationContext | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [isLoadingLogbooks, setIsLoadingLogbooks] = useState(true);
  const [isCreatingLogbook, setIsCreatingLogbook] = useState(false);
  const [mapError, setMapError] = useState("");

  const openLogbook = (logbookId: string) => {
    window.location.href = `/Logbook/${logbookId}`;
  };

  const loadLogbooks = async (): Promise<Logbook[]> => {
    const { data, error } = await supabase.rpc("get_map_logbooks");

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SupabaseLogbook[];

    return rows.map(convertSupabaseLogbook);
  };

  const displayMarkers = (items: Logbook[]) => {
    if (!map.current) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    logbooksRef.current = items;

    items.forEach((logbook) => {
      const element = document.createElement("div");
      element.setAttribute("draggable", "false");

      const markerBody = document.createElement("div");
      markerBody.textContent = "📖";
      markerBody.title = logbook.name;
      markerBody.draggable = false;
      markerBody.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: #111827;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 21px;
        border: 3px solid white;
        box-shadow: 0 5px 16px rgba(0,0,0,0.28);
        cursor: pointer;
        transition: transform 0.15s ease;
        user-select: none;
      `;

      markerBody.addEventListener("mouseenter", () => {
        markerBody.style.transform = "scale(1.12)";
      });
      markerBody.addEventListener("mouseleave", () => {
        markerBody.style.transform = "scale(1)";
      });
      markerBody.addEventListener("dragstart", (event) => {
        event.preventDefault();
      });

      element.appendChild(markerBody);

      const marker = new Marker({
        element,
        anchor: "bottom",
      })
        .setLngLat([logbook.longitude, logbook.latitude])
        .addTo(map.current!);

      element.addEventListener("click", (event) => {
        event.stopPropagation();

        if (!map.current) return;

        popup.current?.remove();

        const latestEntry =
          logbook.entries.length > 0 ? logbook.entries[0] : null;

        const latestPhoto =
          latestEntry?.photos?.[0] ?? null;

        const content = document.createElement("div");
        content.style.width = "270px";
        content.style.padding = "2px";

        if (latestPhoto) {
          const image = document.createElement("img");
          image.src = latestPhoto;
          image.alt = logbook.name;
          image.style.cssText = `
            width: 100%;
            height: 125px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 12px;
          `;
          content.appendChild(image);
        }

        const title = document.createElement("h3");
        title.textContent = `📖 ${logbook.name}`;
        title.style.cssText = `
          margin: 0 0 8px;
          font-size: 18px;
          line-height: 1.3;
          font-weight: 700;
          color: #111827;
          overflow-wrap: anywhere;
        `;
        content.appendChild(title);

        const count = document.createElement("p");
        count.textContent =
          `${logbook.entries.length} ${
            logbook.entries.length === 1
              ? "visitor entry"
              : "visitor entries"
          }`;
        count.style.cssText =
          "margin: 0 0 8px; font-size: 11px; color: #9ca3af;";
        content.appendChild(count);

        if (logbook.locationContext?.displayName) {
          const location = document.createElement("p");
          location.textContent =
            `📍 ${logbook.locationContext.displayName}`;
          location.style.cssText =
            "margin: 0 0 12px; font-size: 11px; color: #6b7280;";
          content.appendChild(location);
        }

        const entry = document.createElement("p");
        entry.textContent = latestEntry
          ? latestEntry.text
          : "The first page of this logbook is still blank.";
        entry.style.cssText = `
          margin: 0 0 14px;
          font-size: 13px;
          line-height: 1.55;
          color: ${latestEntry ? "#4b5563" : "#9ca3af"};
          overflow-wrap: anywhere;
        `;
        content.appendChild(entry);

        const button = document.createElement("button");
        button.textContent = "Open Logbook";
        button.style.cssText = `
          width: 100%;
          padding: 10px 12px;
          border: 0;
          border-radius: 10px;
          background: #111827;
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        `;
        button.addEventListener("click", () => openLogbook(logbook.id));
        content.appendChild(button);

        popup.current = new Popup({
          offset: 18,
          closeButton: true,
          closeOnClick: true,
          maxWidth: "320px",
        })
          .setLngLat([logbook.longitude, logbook.latitude])
          .setDOMContent(content)
          .addTo(map.current);
      });

      element.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        openLogbook(logbook.id);
      });

      markers.current.push(marker);
    });
  };

  const getLocationContext = async (
    latitude: number,
    longitude: number
  ): Promise<LocationContext> => {
    const cacheKey = `travel-location-${latitude.toFixed(
      4
    )}-${longitude.toFixed(4)}`;

    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached) as LocationContext;
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    const response = await fetch(
      `/api/reverse-geocode?lat=${encodeURIComponent(
        latitude
      )}&lon=${encodeURIComponent(longitude)}`
    );

    if (!response.ok) {
      throw new Error("Geocoding failed");
    }

    const data = await response.json();
    const address = data.address ?? {};

    const context: LocationContext = {
      displayName: data.displayName ?? "",
      name: data.name ?? "",
      city: address.city,
      town: address.town,
      village: address.village,
      municipality: address.municipality,
      district:
        address.state_district ?? address.district ?? address.county,
      state: address.state,
      country: address.country,
    };

    localStorage.setItem(cacheKey, JSON.stringify(context));

    return context;
  };

  useEffect(() => {
    mountedRef.current = true;

    if (!mapContainer.current || map.current) {
      return () => {
        mountedRef.current = false;
      };
    }

    const mapInstance = new Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm-tiles",
          },
        ],
      },
      center: [0, 20],
      zoom: 1,
      dragPan: true,
      dragRotate: false,
      doubleClickZoom: true,
      scrollZoom: true,
      boxZoom: true,
      keyboard: true,
      touchZoomRotate: true,
    });

    map.current = mapInstance;

    mapInstance.on("error", (event) => {
      console.error("MapLibre map error:", event.error);

      if (mountedRef.current) {
        setMapError(
          event.error instanceof Error
            ? `The map couldn't load: ${event.error.message}`
            : "The map couldn't load. Check the phone's connection and reload the page."
        );
      }
    });

    mapInstance.addControl(new NavigationControl(), "top-right");

    const canvas = mapInstance.getCanvas();
    canvas.style.cursor = "grab";
    canvas.style.userSelect = "none";
    canvas.style.touchAction = "none";

    const handleMouseDown = () => {
      canvas.style.cursor = "grabbing";
    };

    const handleMouseUp = () => {
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    const updateCoordinates = () => {
      const center = mapInstance.getCenter();

      setPointedCoordinates({
        latitude: center.lat,
        longitude: center.lng,
      });
    };

    mapInstance.on("move", updateCoordinates);

    void (async () => {
      let timeoutId: number | undefined;

      try {
        const items = await Promise.race([
          loadLogbooks(),
          new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(
              () => reject(new Error("The request timed out. Check the phone's connection and reload the page.")),
              15000
            );
          }),
        ]);

        if (mountedRef.current && map.current === mapInstance) {
          displayMarkers(items);
        }
      } catch (error) {
        console.error("Could not load Supabase logbooks:", error);

        if (mountedRef.current) {
          setMapError(
            error instanceof Error
              ? `Couldn't load logbooks: ${error.message}`
              : "Couldn't load logbooks from Supabase."
          );
        }
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        if (mountedRef.current) {
          setIsLoadingLogbooks(false);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      popup.current?.remove();
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  const startPointing = () => {
    if (!map.current) return;

    popup.current?.remove();

    const center = map.current.getCenter();

    setPointedCoordinates({
      latitude: center.lat,
      longitude: center.lng,
    });

    setLocationContext(null);
    setLocationError(false);
    setMapError("");
    setIsPointing(true);
  };

  const confirmPoint = async () => {
    if (!map.current) return;

    const center = map.current.getCenter();

    setPointedCoordinates({
      latitude: center.lat,
      longitude: center.lng,
    });

    setIsPointing(false);
    setShowCreatePanel(true);
    setLocationContext(null);
    setLocationError(false);
    setIsLoadingLocation(true);
    setMapError("");

    try {
      const context = await getLocationContext(
        center.lat,
        center.lng
      );
      setLocationContext(context);
    } catch {
      setLocationError(true);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleCreateLogbook = async () => {
    if (
      !map.current ||
      !logbookName.trim() ||
      isCreatingLogbook ||
      isLoadingLocation
    ) {
      return;
    }

    setIsCreatingLogbook(true);
    setMapError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("Please sign in before creating a logbook.");
      }

      const center = map.current.getCenter();

      const { data: newLogbookId, error: createError } =
        await supabase.rpc("create_map_logbook", {
          p_name: logbookName.trim(),
          p_latitude: center.lat,
          p_longitude: center.lng,
          p_location_context: locationContext,
        });

      if (createError) throw createError;

      if (!newLogbookId) {
        throw new Error("Supabase did not return a logbook ID.");
      }

      const items = await loadLogbooks();
      displayMarkers(items);

      setLogbookName("");
      setShowCreatePanel(false);
      setLocationContext(null);

      openLogbook(newLogbookId as string);
    } catch (error) {
      console.error("Could not create Supabase logbook:", error);

      setMapError(
        error instanceof Error
          ? `Couldn't create logbook: ${error.message}`
          : "Couldn't create the logbook. Please try again."
      );
    } finally {
      setIsCreatingLogbook(false);
    }
  };

  const getBestPlaceName = () => {
    if (!locationContext) return null;

    return (
      locationContext.name ||
      locationContext.village ||
      locationContext.town ||
      locationContext.city ||
      locationContext.municipality ||
      locationContext.district ||
      locationContext.state ||
      locationContext.country ||
      null
    );
  };

  const getLocationSummary = () => {
    if (!locationContext) return null;

    const parts = [
      locationContext.village,
      locationContext.town,
      locationContext.city,
      locationContext.district,
      locationContext.state,
      locationContext.country,
    ].filter(Boolean);

    return [...new Set(parts)].join(", ");
  };

  return (
    <div
      className="relative h-[600px] w-full overflow-hidden rounded-2xl"
      style={{
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        ref={mapContainer}
        className="h-full w-full"
        style={{ touchAction: "none" }}
      />

      {isLoadingLogbooks && (
        <div className="absolute right-4 top-4 rounded-xl bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-lg">
          Loading logbooks...
        </div>
      )}

      {mapError && (
        <div
          role="alert"
          className="absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-xl"
        >
          <p>{mapError}</p>
          <button
            type="button"
            onClick={() => setMapError("")}
            className="mt-2 text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {isPointing && (
        <>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2">
              <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-gray-900" />
              <div className="absolute left-0 top-1/2 h-px w-12 -translate-y-1/2 bg-gray-900" />
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-gray-900" />
            </div>
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-2xl bg-white px-5 py-3 text-center shadow-xl">
            <p className="text-xs font-semibold text-gray-900">
              Select a location
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              {pointedCoordinates.latitude.toFixed(5)},{" "}
              {pointedCoordinates.longitude.toFixed(5)}
            </p>
          </div>
        </>
      )}

      {!isPointing && !showCreatePanel && (
        <div className="absolute left-4 top-4">
          <button
            onClick={startPointing}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold shadow-lg transition hover:bg-gray-100"
          >
            <span>📍</span>
            <span>Point a location</span>
          </button>
        </div>
      )}

      {isPointing && (
        <div className="absolute left-4 top-4 rounded-2xl bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg">
              📍
            </div>

            <div>
              <p className="text-sm font-semibold">
                Choose a location
              </p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-gray-500">
                Move the map underneath the crosshair until it is
                exactly where you want the logbook.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setIsPointing(false)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              onClick={confirmPoint}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {showCreatePanel && (
        <div className="absolute left-1/2 top-1/2 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-2xl">
          <p className="text-sm font-medium text-gray-500">
            New location
          </p>

          <h3 className="mt-1 text-2xl font-bold">
            Create a logbook here?
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Give this place a name. Other travellers will be able
            to discover its logbook on the map.
          </p>

          <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-400">
              GEOGRAPHIC CONTEXT
            </p>

            {isLoadingLocation ? (
              <p className="mt-2 text-sm text-gray-500">
                Identifying this location...
              </p>
            ) : locationError ? (
              <p className="mt-2 text-sm text-gray-500">
                We couldn't identify the surrounding area. You can
                still create the logbook manually.
              </p>
            ) : locationContext ? (
              <>
                {getBestPlaceName() && (
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    📍 {getBestPlaceName()}
                  </p>
                )}

                {getLocationSummary() && (
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {getLocationSummary()}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                No geographic information available.
              </p>
            )}

            <p className="mt-3 text-xs text-gray-400">
              {pointedCoordinates.latitude.toFixed(5)},{" "}
              {pointedCoordinates.longitude.toFixed(5)}
            </p>

            <p className="mt-2 text-[10px] leading-4 text-gray-400">
              Geographic context from OpenStreetMap.
            </p>
          </div>

          <input
            type="text"
            value={logbookName}
            onChange={(event) => setLogbookName(event.target.value)}
            placeholder={
              getBestPlaceName()
                ? `e.g. ${getBestPlaceName()}`
                : "Give this place a name"
            }
            className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
          />

          <p className="mt-2 text-xs leading-5 text-gray-400">
            This is the name travellers will see for the logbook.
            It can be different from the geographic location above.
          </p>

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                setShowCreatePanel(false);
                setLogbookName("");
                setLocationContext(null);
                setLocationError(false);
                setMapError("");
              }}
              disabled={isCreatingLogbook}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleCreateLogbook}
              disabled={
                !logbookName.trim() ||
                isLoadingLocation ||
                isCreatingLogbook
              }
              className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCreatingLogbook ? "Creating..." : "Create Logbook"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
