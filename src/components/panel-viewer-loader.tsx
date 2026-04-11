"use client";

import dynamic from "next/dynamic";

const PanelViewer = dynamic(
  () => import("@/components/panel-viewer").then((m) => m.PanelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[4/3] rounded-lg border bg-black animate-pulse" />
    ),
  }
);

export { PanelViewer as PanelViewerLoader };
