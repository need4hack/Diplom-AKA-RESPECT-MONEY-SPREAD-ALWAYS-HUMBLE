"use client";

import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { vehicles } from "@/lib/api";

type OptionRecord = { value: string };

type FilterSidebarProps = {
  onFiltersChange: (filters: Record<string, any>) => void;
};

export default function FilterSidebar({ onFiltersChange }: FilterSidebarProps) {
  const [makes, setMakes] = useState<string[]>([]);
  const [bodies, setBodies] = useState<string[]>([]);

  const [selectedMakes, setSelectedMakes] = useState<Set<string>>(new Set());
  const [selectedBodies, setSelectedBodies] = useState<Set<string>>(new Set());
  const [yearRange, setYearRange] = useState<[number, number]>([2000, 2025]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
  const [isActive, setIsActive] = useState<boolean>(false);

  // Fetch filter options once
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/vehicles/options/make/").then((res) => res.json()),
      fetch("/api/vehicles/options/body/").then((res) => res.json()),
    ]).then(([makeRes, bodyRes]) => {
      if (active) {
        if (Array.isArray(makeRes)) setMakes(makeRes.map((m: OptionRecord) => String(m.value)).filter(v => v.trim() !== ""));
        if (Array.isArray(bodyRes)) setBodies(bodyRes.map((b: OptionRecord) => String(b.value)).filter(v => v.trim() !== ""));
      }
    });
    return () => { active = false; };
  }, []);

  // Sync to parent
  useEffect(() => {
    const filters: Record<string, any> = {};
    if (selectedMakes.size > 0) filters.make__in = Array.from(selectedMakes).join(",");
    if (selectedBodies.size > 0) filters.body__in = Array.from(selectedBodies).join(",");
    
    // Only apply range if not touching edges
    if (yearRange[0] > 2000) filters.year_min = yearRange[0];
    if (yearRange[1] < 2025) filters.year_max = yearRange[1];

    if (priceRange[0] > 0) filters.price_min = priceRange[0];
    if (priceRange[1] < 500000) filters.price_max = priceRange[1];

    if (isActive) filters.is_active = "True";

    const timeout = setTimeout(() => {
      onFiltersChange(filters);
    }, 400);

    return () => clearTimeout(timeout);
  }, [selectedMakes, selectedBodies, yearRange, priceRange, isActive]);

  const toggleSet = (set: Set<string>, val: string, updateFn: (s: Set<string>) => void) => {
    const newSet = new Set(set);
    if (newSet.has(val)) newSet.delete(val);
    else newSet.add(val);
    updateFn(newSet);
  };

  return (
    <div className="w-64 flex-shrink-0 bg-background/50 border rounded-md p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold px-1">Filters</h3>
        <button 
          onClick={() => {
            setSelectedMakes(new Set()); setSelectedBodies(new Set());
            setYearRange([2000, 2025]); setPriceRange([0, 500000]);
            setIsActive(false);
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <label className="text-sm cursor-pointer select-none" htmlFor="active-switch">
          Active only
        </label>
        <Switch 
          id="active-switch" 
          checked={isActive} 
          onCheckedChange={setIsActive} 
        />
      </div>

      <Accordion type="multiple" defaultValue={["year", "price", "make", "body"]} className="w-full">
        
        <AccordionItem value="year" className="border-b-0 pb-2">
          <AccordionTrigger className="py-2 text-sm">Year Range</AccordionTrigger>
          <AccordionContent className="pt-4 px-1 pb-4">
            <Slider
              min={2000} max={2025} step={1}
              value={yearRange}
              onValueChange={(val) => setYearRange(val as [number, number])}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{yearRange[0]}</span>
              <span>{yearRange[1]}</span>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price" className="border-b-0 pb-2">
          <AccordionTrigger className="py-2 text-sm">Price (USD)</AccordionTrigger>
          <AccordionContent className="pt-4 px-1 pb-4">
            <Slider
              min={0} max={500000} step={1000}
              value={priceRange}
              onValueChange={(val) => setPriceRange(val as [number, number])}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>${priceRange[0].toLocaleString()}</span>
              <span>${priceRange[1].toLocaleString()}</span>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="make" className="border-b-0 pb-2">
          <AccordionTrigger className="py-2 text-sm">Make</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2 overflow-y-auto pr-2 custom-scrollbar" style={{ height: '350px' }}>
              {makes.length === 0 ? (
                <div className="text-sm text-muted-foreground animate-pulse">Loading makes...</div>
              ) : (
                makes.slice(0, 200).map((make) => (
                  <div key={make} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`make-${make}`} 
                      checked={selectedMakes.has(make)}
                      onCheckedChange={() => toggleSet(selectedMakes, make, setSelectedMakes)}
                    />
                    <label htmlFor={`make-${make}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {make}
                    </label>
                  </div>
                ))
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="body" className="border-b-0">
          <AccordionTrigger className="py-2 text-sm">Body Type</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2 overflow-y-auto pr-2 custom-scrollbar" style={{ height: '350px' }}>
              {bodies.length === 0 ? (
                <div className="text-sm text-muted-foreground animate-pulse">Loading body types...</div>
              ) : (
                bodies.map((body) => (
                  <div key={body} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`body-${body}`} 
                      checked={selectedBodies.has(body)}
                      onCheckedChange={() => toggleSet(selectedBodies, body, setSelectedBodies)}
                    />
                    <label htmlFor={`body-${body}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {body}
                    </label>
                  </div>
                ))
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
