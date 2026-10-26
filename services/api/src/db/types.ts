import { customType } from "drizzle-orm/pg-core";

export type LatLng = { lat: number; lng: number };

// PostGIS point, SRID 4326. Write: {lat,lng}. Read: decoded from EWKB hex.
export const geoPoint = customType<{ data: LatLng; driverData: string }>({
  dataType: () => "geometry(Point,4326)",
  toDriver: (v) => `SRID=4326;POINT(${v.lng} ${v.lat})`,
  fromDriver: (hex) => parsePointHex(hex),
});

// PostGIS polygon, SRID 4326. Write: closed ring of [lng, lat]. Read: raw EWKB hex.
export const geoPolygon = customType<{ data: [number, number][]; driverData: string }>({
  dataType: () => "geometry(Polygon,4326)",
  toDriver: (ring) => `SRID=4326;POLYGON((${ring.map(([x, y]) => `${x} ${y}`).join(",")}))`,
  fromDriver: (hex) => hex as unknown as [number, number][],
});

export function parsePointHex(hex: string): LatLng {
  const buf = Buffer.from(hex, "hex");
  const little = buf.readUInt8(0) === 1;
  const typeWord = little ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const off = (typeWord & 0x20000000) !== 0 ? 9 : 5;
  const lng = little ? buf.readDoubleLE(off) : buf.readDoubleBE(off);
  const lat = little ? buf.readDoubleLE(off + 8) : buf.readDoubleBE(off + 8);
  return { lat, lng };
}
