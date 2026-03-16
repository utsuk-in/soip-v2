import React, { useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";
import type { Opportunity } from "../../lib/api";
import { STATE_GEO_CENTERS, matchStateToGeo, normalizeStateName } from "../../lib/india-states-geo";
import { useDarkMode } from "../../hooks/useDarkMode";
import StateSidebar from "./StateSidebar";
import StateTooltip from "./StateTooltip";
import indiaGeo from "../../assets/india-states.json";

const INDIA_CENTER: [number, number] = [78.9, 22.5];
const INDIA_SCALE = 1000;

interface Props {
  opportunities: Opportunity[];
  userState: string | null;
  loading: boolean;
  onOpportunityClick: (id: string) => void;
}

export default function IndiaMapView({ opportunities, userState, loading, onOpportunityClick }: Props) {
  const isDark = useDarkMode();
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const normalizedUserState = userState ? normalizeStateName(userState) : null;

  const oppsByState = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const opp of opportunities) {
      const loc = opp.state || opp.location || "";
      const stateName = matchStateToGeo(loc);
      if (stateName) {
        const existing = map.get(stateName) || [];
        existing.push(opp);
        map.set(stateName, existing);
      }
    }
    return map;
  }, [opportunities]);

  const { center, scale } = useMemo(() => {
    if (normalizedUserState && normalizedUserState !== "Pan India") {
      const geo = STATE_GEO_CENTERS[normalizedUserState];
      if (geo) return { center: geo.center as [number, number], scale: 2500 };
    }
    return { center: INDIA_CENTER, scale: INDIA_SCALE };
  }, [normalizedUserState]);

  const selectedOpps = selectedState ? oppsByState.get(selectedState) || [] : [];

  const fillDefault = isDark ? "#292524" : "#f5f5f4";
  const fillHasData = isDark ? "#164e63" : "#a5f3fc";
  const fillHover = "#22d3ee";
  const fillSelected = "#06b6d4";
  const fillUserState = "#0891b2";
  const strokeColor = isDark ? "#44403c" : "#d6d3d1";

  return (
    <div className="flex h-full relative">
      <div className="flex-1 relative min-h-[420px]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center, scale }}
          className="w-full h-full"
          style={{ background: "transparent" }}
        >
          <ZoomableGroup>
            <Geographies geography={indiaGeo as any}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => {
                  const stateName = geo.properties.ST_NM;
                  const count = oppsByState.get(stateName)?.length || 0;
                  const isSelected = selectedState === stateName;
                  const isUserState = normalizedUserState === stateName;

                  let fill = fillDefault;
                  if (isSelected) fill = fillSelected;
                  else if (isUserState) fill = fillUserState;
                  else if (count > 0) fill = fillHasData;

                  return (
                    <Geography
                      key={geo.rpisoAlpha2 || stateName}
                      geography={geo}
                      onMouseEnter={(e: React.MouseEvent) => {
                        setHoveredState(stateName);
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e: React.MouseEvent) => {
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => {
                        setHoveredState(null);
                        setTooltipPos(null);
                      }}
                      onClick={() => setSelectedState(stateName)}
                      style={{
                        default: {
                          fill,
                          stroke: strokeColor,
                          strokeWidth: 0.5,
                          outline: "none",
                          transition: "all 0.2s",
                        },
                        hover: {
                          fill: fillHover,
                          stroke: "#0891b2",
                          strokeWidth: 1,
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: { fill: fillSelected, outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {Array.from(oppsByState.entries()).map(([state, opps]) => {
              const geo = STATE_GEO_CENTERS[state];
              if (!geo) return null;
              return (
                <Marker key={state} coordinates={geo.center}>
                  <circle
                    r={Math.min(4 + opps.length * 1.5, 12)}
                    fill="#06b6d4"
                    fillOpacity={0.8}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  <text
                    textAnchor="middle"
                    y={4}
                    style={{ fontSize: 8, fill: "#fff", fontWeight: "bold" }}
                  >
                    {opps.length}
                  </text>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-stone-900/40 backdrop-blur-[2px]">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        )}

        {hoveredState && tooltipPos && (
          <StateTooltip
            stateName={hoveredState}
            count={oppsByState.get(hoveredState)?.length || 0}
            x={tooltipPos.x}
            y={tooltipPos.y}
          />
        )}
      </div>

      {selectedState && (
        <StateSidebar
          stateName={selectedState}
          opportunities={selectedOpps}
          onClose={() => setSelectedState(null)}
          onOpportunityClick={onOpportunityClick}
        />
      )}
    </div>
  );
}
