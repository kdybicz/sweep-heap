import BoardChoreButton from "@/app/household/board/components/BoardChoreButton";
import type { MultiDaySpan } from "@/app/household/board/multi-day-chore-layout";

type MultiDayChoreLanesProps = {
  lanes: MultiDaySpan[][];
  onPreviewChore: (chore: MultiDaySpan["chore"], anchorElement: HTMLElement) => void;
};

const getShapeClasses = (span: MultiDaySpan) => {
  const leftShape = span.continuesBefore ? "rounded-l-none border-l-0" : "rounded-l-[0.72rem]";
  const rightShape = span.continuesAfter ? "rounded-r-none border-r-0" : "rounded-r-[0.72rem]";

  return `${leftShape} ${rightShape}`;
};

export default function MultiDayChoreLanes({ lanes, onPreviewChore }: MultiDayChoreLanesProps) {
  if (!lanes.length) {
    return null;
  }

  return (
    <div className="pb-2 pt-2">
      <div className="flex flex-col gap-1.5">
        {lanes.map((lane) => (
          <div className="grid grid-cols-7 gap-0" key={lane.map((span) => span.key).join("|")}>
            {lane.map((span) => (
              <div
                className="relative px-2"
                key={span.key}
                style={{ gridColumn: `${span.startCol + 1} / span ${span.colSpan}` }}
              >
                <BoardChoreButton
                  chore={span.chore}
                  className="h-11 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onPreviewChore={onPreviewChore}
                  shapeClassName={getShapeClasses(span)}
                />
                {span.continuesBefore ? <span aria-hidden="true" data-continuation="left" /> : null}
                {span.continuesAfter ? <span aria-hidden="true" data-continuation="right" /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
