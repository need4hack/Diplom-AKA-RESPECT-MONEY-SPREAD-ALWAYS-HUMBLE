"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/contexts/PreferencesContext";

export interface DamageSelection {
  key: string;
  id: string;
  label: string;
}

type DamagePart =
  | {
      id: string;
      label: string;
      element: "path";
      d: string;
      transform?: string;
    }
  | {
      id: string;
      label: string;
      element: "circle";
      cx: number;
      cy: number;
      r: number;
      transform?: string;
    };

type DamageViewKey = "front" | "side";

type DamageMapSelectorProps = {
  initialValue?: DamageSelection[];
  onChange?: (next: DamageSelection[]) => void;
};

const DAMAGE_VIEWS: Record<
  DamageViewKey,
  {
    label: string;
    imageSrc: string;
    defaultViewBox: string;
    parts: DamagePart[];
    imageClassName?: string;
    groupTransform?: string;
  }
> = {
  side: {
    label: "Right Side View",
    imageSrc: "/damage-map/side-view.png",
    defaultViewBox: "0 0 640 220",
    parts: [
      { id: "REAR_BUMPER", label: "Rear bumper", element: "path", d: "M 7 105 Q 14 108 24 110 Q 90 120 90 120 Q 80 138 82 164 Q 33 158 32 155 Q 16 152 8 138 Z" },
      { id: "REAR_WING", label: "Right rear quarter panel", element: "path", d: "M 7 105 Q 14 108 24 110 Q 90 120 90 120 Q 113 93 148 101 Q 179 109 186 145 Q 194 145 194 145 Q 185 110 157 97 Q 131 79 134 51 Q 135 42 140 37 Q 158 26 177 20 Q 175 12 175 12 Q 125 27 79 46 Q 67 49 26 52 Q 22 56 22 56 Q 22 62 22 62 Q 19 67 19 67 Q 47 66 47 66 Q 52 67 55 70 Q 43 80 28 89 Q 19 88 20 88 Q 15 95 15 95 Q 15 100 15 100 Z" },
      { id: "REAR_DOOR", label: "Right rear door", element: "path", d: "M 292 54 Q 300 99 294 156 L 223 154 Q 200 153 194 144 Q 185 110 157 97 Q 139 86 135 62 Q 134 56 134 51 Z" },
      { id: "FRONT_DOOR", label: "Right front door", element: "path", d: "M 292 54 Q 300 99 294 156 L 451 158 Q 464 106 457 74 Q 452 66 445 61 Z" },
      { id: "FRONT_WING", label: "Right front fender", element: "path", d: "M 445 61 L 484 62 L 489 67 Q 493 69 501 70 Q 506 71 513 72 Q 528 73 543 75 Q 569 79 586 85 Q 578 85 570 88 Q 545 104 545 104 Q 529 95 511 98 Q 477 102 464 139 L 462 154 L 462 158 L 451 158 Q 464 106 457 74 Q 452 66 445 61 Z" },
      { id: "FRONT_BUMPER", label: "Front bumper", element: "path", d: "M 570 88 Q 545 104 545 104 Q 569 116 571 143 Q 571 155 571 166 Q 600 167 626 167 L 631 159 L 626 157 L 627 143 L 630 140 L 631 131 L 630 124 L 624 104 L 616 103 Q 606 104 606 104 Q 600 111 602 109 Q 592 107 570 88 Z" },
      { id: "ROCKER_PANEL", label: "Right rocker panel", element: "path", d: "M 186 144 L 194 144 Q 200 153 223 154 L 294 156 L 451 158 L 462 158 L 462 170 L 186 168 Z" },
      { id: "REAR_WHEEL", label: "Right rear wheel", element: "circle", cx: 133, cy: 153, r: 44 },
      { id: "FRONT_WHEEL", label: "Right front wheel", element: "circle", cx: 517, cy: 153, r: 44 },
      { id: "REAR_WHEEL_DISK", label: "Right rear rim", element: "circle", cx: 133, cy: 153, r: 30 },
      { id: "FRONT_WHEEL_DISK", label: "Right front rim", element: "circle", cx: 518, cy: 153, r: 30 },
      { id: "REAR_LIGHTS", label: "Right tail light", element: "path", d: "M 22 67 Q 20 72 20 72 Q 20 87 20 87 Q 25 88 25 88 Q 40 80 54 71 Q 49 66 49 66 Z" },
      { id: "FRONT_LIGHTS", label: "Right headlight", element: "path", d: "M 570 88 Q 578 85 585 85 L 616 95 L 616 103 L 606 104 Q 600 111 602 109 Q 592 107 570 88 Z" },
      { id: "RIGHT_MIRROR", label: "Right mirror", element: "path", d: "M 406 43 Q 406 52 406 55 Q 409 59 409 59 Q 418 60 425 60 Q 431 57 431 55 Q 427 52 427 52 Q 426 46 421 43 Q 419 41 415 39 Q 408 39 408 39 Z" },
      { id: "BONNET", label: "Hood", element: "path", d: "M 484 62 Q 529 67 573 77 Q 597 83 620 93 Q 586 85 586 85 Q 569 79 543 75 Q 528 73 513 72 Q 506 71 501 70 Q 493 69 489 67 Z" },
      { id: "BACK_PASSENGER_WINDOW", label: "Right rear window", element: "path", d: "M 280 9 Q 282 53 282 53 Q 139 50 138 50 Q 139 43 143 40 Q 150 31 195 17 Q 211 12 236 10 Z" },
      { id: "FRONT_PASSENGER_WINDOW", label: "Right front window", element: "path", d: "M 294 10 Q 304 54 304 54 Q 408 59 408 59 Q 404 54 404 54 Q 404 44 404 44 Q 406 39 406 39 Q 381 24 368 20 Q 349 13 330 10 Q 301 9 301 9 Z" },
      { id: "ROOF", label: "Roof", element: "path", d: "M 175 12 L 177 20 Q 204 10 218 9 Q 233 6 278 6 Q 331 8 331 8 Q 347 11 364 16 Q 367 12 367 12 Q 348 6 330 3 Q 274 1 274 1 Q 238 1 214 4 Z" },
    ],
  },
  front: {
    label: "Front View",
    imageSrc: "/damage-map/front-view.png",
    defaultViewBox: "0 0 360 200",
    parts: [
      { id: "WINDOW", label: "Windshield", element: "path", d: "M 104 12 Q 177 9 252 11 Q 269 35 276 56 Q 86 55 82 55 Q 93 28 103 14 Z" },
      { id: "RIGHT_MIRROR", label: "Right mirror", element: "path", d: "M 71 48 Q 72 39 72 39 Q 57 39 57 39 Q 53 40 48 42 Q 45 48 48 54 Q 56 56 68 57 Q 75 57 75 57 Q 78 50 78 50 Z" },
      { id: "BONNET", label: "Hood", element: "path", d: "M 180 87 Q 209 88 236 89 Q 242 91 246 91 Q 264 86 281 82 Q 286 64 281 57 Q 180 55 180 55 Q 79 57 79 57 Q 74 64 79 82 Q 96 86 114 91 Q 118 91 124 89 Q 151 88 180 87 Z", transform: "translate(-2, 0)" },
      { id: "FRONT_LIGHTS", label: "Right headlight", element: "path", d: "M 67 81 Q 83 82 112 91 Q 106 99 106 99 Q 82 99 82 99 Q 80 101 76 102 Q 65 102 63 96 Q 61 88 62 86 Z" },
      { id: "FRONT_BUMPER", label: "Front bumper", element: "path", d: "M 178 123 L 130 122 Q 118 116 106 99 L 82 99 Q 80 101 76 102 Q 65 102 63 96 Q 61 88 62 86 L 53 96 L 53 164 Q 73 168 102 169 L 177 169 L 252 168 Q 280 168 301 165 L 303 96 L 294 86 Q 295 88 293 96 Q 291 102 280 102 Q 276 101 274 99 L 250 99 Q 238 116 226 122 Z" },
      { id: "ROOF", label: "Roof", element: "path", d: "M 108 10 Q 180 5 252 10 Q 248 5 246 4 Q 180 0 114 4 Q 112 5 108 10 Z", transform: "translate(-1, 0)" },
      { id: "FRONT_WING", label: "Right front fender", element: "path", d: "M 53 96 L 67 81 Q 72 81 77 82 Q 72 64 77 57 Q 65 65 53 87 Z" },
      { id: "LEFT_FRONT_WING", label: "Left front fender", element: "path", d: "M 307 96 L 293 81 Q 288 81 283 82 Q 288 64 283 57 Q 295 65 307 87 Z", transform: "translate(-4, 0)" },
      { id: "LEFT_MIRROR", label: "Left mirror", element: "path", d: "M 289 48 Q 288 39 288 39 Q 303 39 303 39 Q 307 40 312 42 Q 315 48 312 54 Q 304 56 292 57 Q 285 57 285 57 Q 282 50 282 50 Z", transform: "translate(-3, 0)" },
      { id: "RADIATOR", label: "Grille / radiator area", element: "path", d: "M 178 123 L 130 122 Q 118 116 106 99 L 112 91 Q 116 91 122 89 Q 149 88 178 87 Q 207 88 234 89 Q 240 91 244 91 L 250 99 Q 238 116 226 122 Z" },
      { id: "LEFT_FRONT_LIGHTS", label: "Left headlight", element: "path", d: "M 293 81 Q 277 82 248 91 Q 254 99 254 99 Q 278 99 278 99 Q 280 101 284 102 Q 295 102 297 96 Q 299 88 298 86 Z", transform: "translate(-4, 0)" },
    ],
  },
};

type MirroredPartMeta = {
  id: string;
  label: string;
};

const SIDE_MIRROR_WIDTH = 640;

const MIRRORED_SIDE_PART_META: Partial<Record<string, MirroredPartMeta>> = {
  REAR_WING: { id: "LEFT_REAR_WING", label: "Left rear quarter panel" },
  REAR_DOOR: { id: "LEFT_REAR_DOOR", label: "Left rear door" },
  FRONT_DOOR: { id: "LEFT_FRONT_DOOR", label: "Left front door" },
  FRONT_WING: { id: "LEFT_FRONT_WING", label: "Left front fender" },
  ROCKER_PANEL: { id: "LEFT_ROCKER_PANEL", label: "Left rocker panel" },
  REAR_WHEEL: { id: "LEFT_REAR_WHEEL", label: "Left rear wheel" },
  FRONT_WHEEL: { id: "LEFT_FRONT_WHEEL", label: "Left front wheel" },
  REAR_WHEEL_DISK: { id: "LEFT_REAR_WHEEL_DISK", label: "Left rear rim" },
  FRONT_WHEEL_DISK: { id: "LEFT_FRONT_WHEEL_DISK", label: "Left front rim" },
  REAR_LIGHTS: { id: "LEFT_REAR_LIGHTS", label: "Left tail light" },
  FRONT_LIGHTS: { id: "LEFT_FRONT_LIGHTS", label: "Left headlight" },
  RIGHT_MIRROR: { id: "LEFT_MIRROR", label: "Left mirror" },
  BACK_PASSENGER_WINDOW: { id: "LEFT_REAR_WINDOW", label: "Left rear window" },
  FRONT_PASSENGER_WINDOW: { id: "LEFT_FRONT_WINDOW", label: "Left front window" },
};

function createMirroredSideParts(parts: DamagePart[]): DamagePart[] {
  return parts.map((part) => {
    const mirroredMeta = MIRRORED_SIDE_PART_META[part.id];

    if (!mirroredMeta) {
      return part;
    }

    return {
      ...part,
      id: mirroredMeta.id,
      label: mirroredMeta.label,
    };
  });
}

const DAMAGE_VIEWS_WITH_LEFT: Record<
  DamageViewKey | "leftSide",
  {
    label: string;
    imageSrc: string;
    defaultViewBox: string;
    parts: DamagePart[];
    imageClassName?: string;
    groupTransform?: string;
  }
> = {
  ...DAMAGE_VIEWS,
  leftSide: {
    label: "Left Side View",
    imageSrc: "/damage-map/side-view.png",
    defaultViewBox: "0 0 640 220",
    parts: createMirroredSideParts(DAMAGE_VIEWS.side.parts),
    imageClassName: "[transform:scaleX(-1)]",
    groupTransform: `translate(${SIDE_MIRROR_WIDTH} 0) scale(-1 1)`,
  },
};

type ExtendedDamageViewKey = keyof typeof DAMAGE_VIEWS_WITH_LEFT;

const DAMAGE_VIEW_KEYS = Object.keys(
  DAMAGE_VIEWS_WITH_LEFT
) as ExtendedDamageViewKey[];
const DAMAGE_PARTS_BY_ID = new Map(
  DAMAGE_VIEW_KEYS.flatMap((view) =>
    DAMAGE_VIEWS_WITH_LEFT[view].parts.map((part) => [part.id, part] as const)
  )
);

function renderPart(
  part: DamagePart,
  isSelected: boolean,
  isHovered: boolean,
  onClick: () => void,
  onMouseEnter: () => void,
  onMouseLeave: () => void
) {
  const className = cn(
    "cursor-pointer transition-all duration-150",
    isSelected
      ? "fill-red-500/45 stroke-red-500"
      : isHovered
        ? "fill-sky-500/30 stroke-sky-500"
        : "fill-transparent stroke-white/25"
  );

  if (part.element === "circle") {
    return (
      <circle
        key={part.id}
        className={className}
        cx={part.cx}
        cy={part.cy}
        r={part.r}
        strokeWidth={isSelected ? 3 : 2}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  return (
    <path
      key={part.id}
      className={className}
      d={part.d}
      transform={part.transform}
      strokeWidth={isSelected ? 3 : 2}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

function DamageMapSelector({
  initialValue = [],
  onChange,
}: DamageMapSelectorProps) {
  const { language } = usePreferences();
  const [activeView, setActiveView] = useState<ExtendedDamageViewKey>("side");
  const [hoveredPartKey, setHoveredPartKey] = useState<string | null>(null);
  const [viewBoxes, setViewBoxes] = useState<
    Partial<Record<ExtendedDamageViewKey, string>>
  >({});
  const [selectedItems, setSelectedItems] = useState<DamageSelection[]>(initialValue);

  const activeConfig = DAMAGE_VIEWS_WITH_LEFT[activeView];
  const selectedKeys = useMemo(
    () => new Set(selectedItems.map((item) => item.key)),
    [selectedItems]
  );
  const hoveredPart = hoveredPartKey ? DAMAGE_PARTS_BY_ID.get(hoveredPartKey) ?? null : null;

  const commitSelection = useCallback(
    (next: DamageSelection[]) => {
      setSelectedItems(next);
      onChange?.(next);
    },
    [onChange]
  );

  const handleToggle = useCallback(
    (part: DamagePart) => {
      const key = part.id;
      const existing = selectedItems.find((item) => item.key === key);

      if (existing) {
        commitSelection(selectedItems.filter((item) => item.key !== key));
        return;
      }

      commitSelection([
        ...selectedItems,
        {
          key,
          id: part.id,
          label: part.label,
        },
      ]);
    },
    [commitSelection, selectedItems]
  );

  function handleImageLoad(
    view: ExtendedDamageViewKey,
    event: React.SyntheticEvent<HTMLImageElement>
  ) {
    const image = event.currentTarget;
    setViewBoxes((current) => ({
      ...current,
      [view]: `0 0 ${image.naturalWidth} ${image.naturalHeight}`,
    }));
  }

  const uiText =
    language === "ru"
      ? {
          rightSide: "Вид справа",
          leftSide: "Вид слева",
          front: "Вид спереди",
          clearAll: "Очистить всё",
          selectedTitle: "Выбранные зоны повреждений",
          selectedDescription:
            "Необязательный шаг. Совпадающие ID остаются связанными между доступными видами.",
          noDamage: "Повреждения не выбраны.",
          remove: "Удалить",
        }
      : {
          rightSide: "Right Side View",
          leftSide: "Left Side View",
          front: "Front View",
          clearAll: "Clear all",
          selectedTitle: "Selected damage areas",
          selectedDescription:
            "Optional step. Matching IDs stay linked across available views.",
          noDamage: "No damage selected.",
          remove: "Remove",
        };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
              {DAMAGE_VIEW_KEYS.map((view) => (
                <Button
                  key={view}
                  type="button"
                  variant={activeView === view ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveView(view)}
                >
                  {view === "side"
                    ? uiText.rightSide
                    : view === "leftSide"
                      ? uiText.leftSide
                      : uiText.front}
                </Button>
              ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={selectedItems.length === 0}
          onClick={() => commitSelection([])}
        >
          {uiText.clearAll}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-auto rounded-xl border border-border bg-muted/20 p-4">
          <div className="relative inline-block max-w-full">
            {hoveredPart && (
              <div className="absolute left-3 top-3 z-10 rounded-md bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-border">
                {hoveredPart.label}
              </div>
            )}

            <img
              src={activeConfig.imageSrc}
              alt={`${activeConfig.label} damage map`}
              className={cn(
                "block h-auto max-w-full rounded-md",
                activeConfig.imageClassName
              )}
              onLoad={(event) => handleImageLoad(activeView, event)}
            />

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={viewBoxes[activeView] ?? activeConfig.defaultViewBox}
            >
              <g transform={activeConfig.groupTransform}>
                {activeConfig.parts.map((part) => {
                  const selectionKey = part.id;
                  const isSelected = selectedKeys.has(selectionKey);
                  const isHovered = hoveredPartKey === selectionKey;

                  return renderPart(
                    part,
                    isSelected,
                    isHovered,
                    () => handleToggle(part),
                    () => setHoveredPartKey(selectionKey),
                    () => setHoveredPartKey(null)
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{uiText.selectedTitle}</p>
            <p className="text-xs text-muted-foreground">
              {uiText.selectedDescription}
            </p>
          </div>

          {selectedItems.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {uiText.noDamage}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {selectedItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-3 rounded-lg border border-red-500/15 bg-red-500/10 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.id}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    onClick={() =>
                      commitSelection(
                        selectedItems.filter((selected) => selected.key !== item.key)
                      )
                    }
                    aria-label={`${uiText.remove} ${item.label}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(DamageMapSelector);
