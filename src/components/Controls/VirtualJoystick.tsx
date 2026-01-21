import React, { useRef, useState, useCallback, useEffect } from 'react';
import { gameEvents } from '../../game/managers/EventManager';

interface JoystickPosition {
  x: number;
  y: number;
}

interface VirtualJoystickProps {
  size?: number;
  baseColor?: string;
  stickColor?: string;
  deadzone?: number;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  size = 120,
  baseColor = 'rgba(255, 255, 255, 0.2)',
  stickColor = 'rgba(255, 255, 255, 0.5)',
  deadzone = 0.1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [stickPosition, setStickPosition] = useState<JoystickPosition>({ x: 0, y: 0 });
  const [touchId, setTouchId] = useState<number | null>(null);

  const maxDistance = size / 2 - 15;

  const calculateJoystickOutput = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let deltaX = clientX - centerX;
      let deltaY = clientY - centerY;

      // Calculate distance from center
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const force = Math.min(distance / maxDistance, 1);

      // Clamp to max distance
      if (distance > maxDistance) {
        deltaX = (deltaX / distance) * maxDistance;
        deltaY = (deltaY / distance) * maxDistance;
      }

      // Update stick position
      setStickPosition({ x: deltaX, y: deltaY });

      // Calculate normalized direction
      if (force > deadzone) {
        const normalizedX = deltaX / maxDistance;
        const normalizedY = deltaY / maxDistance;

        // Emit joystick move event
        gameEvents.emit('joystick:move', {
          x: normalizedX,
          y: normalizedY,
          force: force,
        });
      } else {
        gameEvents.emit('joystick:stop', undefined);
      }
    },
    [maxDistance, deadzone]
  );

  const handleStart = useCallback(
    (clientX: number, clientY: number, identifier?: number) => {
      setIsActive(true);
      if (identifier !== undefined) {
        setTouchId(identifier);
      }
      calculateJoystickOutput(clientX, clientY);
    },
    [calculateJoystickOutput]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isActive) return;
      calculateJoystickOutput(clientX, clientY);
    },
    [isActive, calculateJoystickOutput]
  );

  const handleEnd = useCallback(() => {
    setIsActive(false);
    setTouchId(null);
    setStickPosition({ x: 0, y: 0 });
    gameEvents.emit('joystick:stop', undefined);
  }, []);

  // Mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  // Touch event handlers (used by native event listeners for non-passive behavior)
  const handleNativeTouchStart = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleStart(touch.clientX, touch.clientY, touch.identifier);
    },
    [handleStart]
  );

  const handleNativeTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          handleMove(touch.clientX, touch.clientY);
          break;
        }
      }
    },
    [handleMove, touchId]
  );

  const handleNativeTouchEnd = useCallback(
    (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          handleEnd();
          break;
        }
      }
    },
    [handleEnd, touchId]
  );

  // Add non-passive touch event listeners
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    element.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    element.addEventListener('touchend', handleNativeTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleNativeTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleNativeTouchStart);
      element.removeEventListener('touchmove', handleNativeTouchMove);
      element.removeEventListener('touchend', handleNativeTouchEnd);
      element.removeEventListener('touchcancel', handleNativeTouchEnd);
    };
  }, [handleNativeTouchStart, handleNativeTouchMove, handleNativeTouchEnd]);

  // Global mouse events for dragging outside component
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isActive && touchId === null) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isActive && touchId === null) {
        handleEnd();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isActive, touchId, handleMove, handleEnd]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 20,
        bottom: 20,
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: baseColor,
        border: '2px solid rgba(255, 255, 255, 0.3)',
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Stick */}
      <div
        style={{
          width: size / 2,
          height: size / 2,
          borderRadius: '50%',
          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.7)' : stickColor,
          transform: `translate(${stickPosition.x}px, ${stickPosition.y}px)`,
          transition: isActive ? 'none' : 'transform 0.1s ease-out',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
