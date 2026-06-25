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
          element: "#tour-category",
          popover: {
            title: "What Are You Looking For?",
            description:
              "Choose a category — hotels, restaurants, tours, activities, and more. Each search is focused on one type.",
          },
        },
        {
          element: "#tour-search-input",
          popover: {
            title: "Search Anything",
            description:
              "Describe what you want in plain language. Try 'boutique hotel with a rooftop pool' or 'best local food markets'.",
          },
        },
        {
          element: "#tour-results",
          popover: {
            title: "Ranked by Fit, Not Popularity",
            description:
              "Results are sorted by how well they match your travel personality — not star ratings or sponsored placements.",
          },
        },
        {
          element: "#tour-fit-score",
          popover: {
            title: "Your Fit Score",
            description:
              "See the score badge on each card — click any result to see exactly why it's a good — or bad — fit.",
          },
        },
        {
          element: "#tour-tabs",
          popover: {
            title: "Search, Save, History",
            description:
              "Your current results are here. Save favorites to compare later, or revisit any past search from History.",
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
