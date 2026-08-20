// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

/**
 * Land boundaries for the printed map, from the US Census via `us-atlas`.
 *
 * A bubble map with no basemap is a scatter plot: the circles are in the right
 * places relative to each other and the reader has nothing to place them
 * against. County outlines fix that with the least possible ceremony — around
 * 285 vertices at metro zoom — and they carry more than they look like they
 * do. In Portland the Columbia is the Oregon/Washington line, so the river a
 * reader recognises is drawn for free.
 *
 * Public-domain Census cartographic boundaries, generic across the whole
 * country, which matches `us-zips`' own scope. Nothing here is specific to one
 * agency's geography, so nothing here has to be undone when FEED is deployed
 * somewhere else.
 *
 * Offline and deterministic: a file on disk, decoded once per process. No
 * network call enters the report generator.
 */

type Ring = [number, number][];

/** Decoding costs ~16ms and the result never changes, so it happens once. */
let cache: { counties: GeoFeature[]; states: GeoFeature[] } | null = null;

interface GeoFeature {
  rings: Ring[];
  bounds: { west: number; east: number; south: number; north: number };
}

const ringsOf = (geometry: any): Ring[] => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.map((r: Ring) => r);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap((p: Ring[]) => p);
  return [];
};

const boundsOf = (rings: Ring[]) => {
  let west = 180, east = -180, south = 90, north = -90;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < west) west = x;
      if (x > east) east = x;
      if (y < south) south = y;
      if (y > north) north = y;
    }
  }
  return { west, east, south, north };
};

const load = (): { counties: GeoFeature[]; states: GeoFeature[] } => {
  if (cache) return cache;
  const toFeatures = (path: string, key: string): GeoFeature[] => {
    // Required lazily: a 822KB parse should not happen for a report that
    // contains no map.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const topo = require(path) as Topology;
    const collection = feature(topo, topo.objects[key] as GeometryCollection) as any;
    return collection.features.map((f: any) => {
      const rings = ringsOf(f.geometry);
      return { rings, bounds: boundsOf(rings) };
    });
  };
  cache = {
    counties: toFeatures('us-atlas/counties-10m.json', 'counties'),
    states: toFeatures('us-atlas/states-10m.json', 'states'),
  };
  return cache;
};

/**
 * Boundary rings overlapping a viewport, in longitude/latitude.
 *
 * Returns counties for a local view and states once the frame is wide enough
 * that counties would be a hairball — 3,231 of them across the country. The
 * caller projects; this module only decides which lines are worth drawing.
 */
export function boundaryRingsFor(
  west: number,
  east: number,
  south: number,
  north: number,
): Ring[] {
  const { counties, states } = load();
  // Degrees of longitude across the frame. Roughly a large metro area at 3°;
  // beyond that county lines stop being orientation and start being noise.
  const source = east - west > 3 ? states : counties;
  const overlaps = (f: GeoFeature) =>
    f.bounds.east >= west && f.bounds.west <= east
    && f.bounds.north >= south && f.bounds.south <= north;
  return source.filter(overlaps).flatMap(f => f.rings);
}
