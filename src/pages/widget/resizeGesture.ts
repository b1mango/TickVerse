import {
  beginWidgetResize,
  endWidgetResize,
  setWidgetFrame,
  type WidgetResizeDirection,
} from '@/adapters/desktopWidget';

export function startResize(dir: WidgetResizeDirection, onResizeState: (active: boolean) => void) {
  return (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startClient = { x: e.screenX, y: e.screenY };
    type NativeFrame = Awaited<ReturnType<typeof beginWidgetResize>>;
    let startFrame: NativeFrame | null = null;
    let latestPoint = { x: e.screenX, y: e.screenY };
    let latestFrame: NativeFrame | null = null;
    let writing = false;
    let ended = false;
    let beginning = true;
    let finishing = false;

    onResizeState(true);

    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      onResizeState(false);
    };

    const finishWhenIdle = async () => {
      if (beginning || finishing || writing || latestFrame) return;
      finishing = true;
      try {
        await endWidgetResize();
      } catch {
        console.error('结束组件缩放失败');
      } finally {
        cleanup();
      }
    };

    const flush = async () => {
      if (writing || !latestFrame) return;
      writing = true;
      const frame = latestFrame;
      latestFrame = null;
      await setWidgetFrame(frame, dir).catch(() => undefined);
      writing = false;
      if (latestFrame) {
        void flush();
      } else if (ended) {
        void finishWhenIdle();
      }
    };

    const updateFrame = (point: { x: number; y: number }) => {
      if (!startFrame) return;
      const dx = point.x - startClient.x;
      const dy = point.y - startClient.y;
      let { width, height, x, y } = startFrame;
      if (dir.includes('East')) width = startFrame.width + dx;
      if (dir.includes('West')) {
        width = startFrame.width - dx;
        x = startFrame.x + dx;
      }
      // AppKit 原点在左下角：South 边向下移动时，原点 y 反向移动；North 只改变高度。
      if (dir.includes('South')) {
        height = startFrame.height + dy;
        y = startFrame.y - dy;
      }
      if (dir.includes('North')) height = startFrame.height - dy;
      latestFrame = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      };
      void flush();
    };

    const move = (ev: PointerEvent) => {
      if (ended) return;
      latestPoint = { x: ev.screenX, y: ev.screenY };
      updateFrame(latestPoint);
    };

    const finish = () => {
      if (ended) return;
      ended = true;
      void flush();
      void finishWhenIdle();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: false });
    window.addEventListener('pointercancel', finish, { once: false });

    void beginWidgetResize()
      .then((frame) => {
        beginning = false;
        startFrame = frame;
        if (ended) {
          void finishWhenIdle();
        } else {
          updateFrame(latestPoint);
        }
      })
      .catch(() => {
        ended = true;
        cleanup();
      });
  };
}
