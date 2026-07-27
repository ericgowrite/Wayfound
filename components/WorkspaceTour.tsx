"use client";

import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface Props {
  onDone: () => void;
}

export default function WorkspaceTour({ onDone }: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const doneCalledRef = { current: false };
    const mobile = window.innerWidth < 768;

    const driverObj = driver({
      animate: true,
      overlayOpacity: 0.65,
      stagePadding: 10,
      allowClose: true,
      overlayClickBehavior: "close",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Let's go →",
      onPopoverRender: (popover) => {
        popover.closeButton.innerHTML = "Skip tour";
      },
      onDestroyed: () => {
        if (!doneCalledRef.current) {
          doneCalledRef.current = true;
          onDoneRef.current();
        }
      },
      steps: [
        {
          ...(mobile ? {} : { element: "#tour-category" }),
          popover: {
            title: "Pick a category",
            description:
              "Hotels, restaurants, tours, activities, and more. Each search focuses on one type so results stay sharp.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-search-input" }),
          popover: {
            title: "Search Anything",
            description:
              "Describe what you want in plain language. Try 'boutique hotel with a rooftop pool' or 'best local food markets'.",
          },
        },
        {
          // Always target #tour-results (always in DOM); #tour-fit-score only
          // exists when results are present, which breaks the tour for new users.
          element: "#tour-results",
          popover: {
            title: "Ranked by Fit, Not Popularity",
            description:
              "Results are sorted by how well they match your travel personality — not star ratings or sponsored placements.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-results" }),
          popover: {
            title: "Your Fit Score",
            description:
              "Each result shows how well it fits you. Tap any card to see exactly why — including what might not work.",
          },
        },
        {
          element: "#tour-tabs",
          popover: {
            title: "Your whole experience, in one place.",
            description:
              "Results here, saved finds in Saved, everything you've ever searched in History. Move between them however you need.",
          },
        },
      ],
    });

    driverObj.drive();

    return () => {
      doneCalledRef.current = true;
      try { if (driverObj.isActive()) driverObj.destroy(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
