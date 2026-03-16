import React from "react";
import { X, MapPin } from "lucide-react";
import OpportunityCard from "../OpportunityCard";
import type { Opportunity } from "../../lib/api";

interface Props {
  stateName: string;
  opportunities: Opportunity[];
  onClose: () => void;
  onOpportunityClick: (id: string) => void;
}

export default function StateSidebar({ stateName, opportunities, onClose, onOpportunityClick }: Props) {
  return (
    <aside className="fixed lg:static inset-x-0 bottom-0 lg:inset-auto h-[60vh] lg:h-auto w-full lg:w-96 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-stone-200/60 dark:border-stone-800/60 flex flex-col animate-fade-in overflow-hidden rounded-t-3xl lg:rounded-none z-20">
      <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-brand-600" />
          <h3 className="font-bold text-stone-800 dark:text-stone-100 font-display">{stateName}</h3>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {opportunities.length} event{opportunities.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {opportunities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-stone-400 dark:text-stone-500 text-sm">No events in {stateName} yet.</p>
            <p className="text-xs text-stone-400 mt-1">Check back soon or explore online events.</p>
          </div>
        ) : (
          opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              compact
              onClick={() => onOpportunityClick(opp.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
