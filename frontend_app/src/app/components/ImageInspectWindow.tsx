import React, { useState, useRef, MouseEvent, WheelEvent } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Move } from "lucide-react";

interface ImageInspectWindowProps {
  imageUrl: string;
  onClose: () => void;
}

export default function ImageInspectWindow({ imageUrl, onClose }: ImageInspectWindowProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.1 : -0.1;
    setScale((prev) => Math.min(Math.max(prev + zoomFactor, 0.5), 4));
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="absolute inset-0 bg-black/95 z-[9999] flex flex-col animate-fade-in border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Header Tool Dock */}
      <div className="flex items-center justify-between px-4 h-12 bg-[#141414] border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-medium uppercase tracking-widest text-slate-300">
            Image Workspace Canvas
          </span>
        </div>
        
        {/* Zoom Controls Grid */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/5 px-2 py-1 rounded-md text-slate-400">
          <button onClick={handleZoomOut} className="p-1 hover:text-white transition-colors" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-[10px] font-mono px-2 text-center w-14">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1 hover:text-white transition-colors" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
          <div className="w-[1px] h-3 bg-white/10 mx-1" />
          <button onClick={handleReset} className="p-1 hover:text-white transition-colors" title="Reset Scale"><RotateCcw className="w-3.5 h-3.5" /></button>
        </div>

        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Canvas Grid */}
      <div 
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#0A0A0A] flex items-center justify-center select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)"
          }}
          className="max-w-[85%] max-h-[85%] flex items-center justify-center pointer-events-none shadow-2xl"
        >
          <img 
            src={imageUrl} 
            alt="Inspected Asset Detail View" 
            className="w-full h-full object-contain border border-white/5 rounded-md bg-black"
          />
        </div>
      </div>
    </div>
  );
}