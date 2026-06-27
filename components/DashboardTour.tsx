"use client";

import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface Props {
  onDone: () => void;
}

export default function DashboardTour({ onDone }: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const doneCalledRef = { current: false };
    // On mobile the sidebar is hidden off-screen — targeting sidebar elements
    // causes Driver.js to position the popover outside the viewport, making
    // the Next/Back buttons unreachable. Use floating popovers instead.
    const mobile = window.innerWidth < 768;

    const driverObj = driver({
      animate: true,
      overlayOpacity: 0.65,
      stagePadding: 10,
      allowClose: true,
      overlayClickBehavior: "close",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Start exploring →",
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
          ...(mobile ? {} : { element: "#tour-travelers" }),
          popover: {
            title: "Your Travelers",
            description:
              "<em>Welcome to ViyaWay — here's a quick tour, takes about 60 seconds.</em><br><br>" +
              "Each traveler has a personality profile that drives their recommendations. Tap a name to view or edit their travel style.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-add-traveler" }),
          popover: {
            title: "Add a Travel Companion",
            description:
              "Planning a group trip? Add others here. ViyaWay scores results for everyone — so you can find places that work for the whole group.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-trips" }),
          popover: {
            title: "Your Trips",
            description:
              "Each trip is its own workspace — search, save, and compare options for a specific destination or travel window.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-create-trip" }),
          popover: {
            title: "Create a Trip",
            description:
              "Start here. Give your trip a name and dates, then search for hotels, restaurants, activities, and more.",
          },
        },
      ],
    });

    driverObj.drive();

    return () => {
      doneCalledRef.current = true; // prevent onDone from firing on unmount cleanup
      try { if (driverObj.isActive()) driverObj.destroy(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
