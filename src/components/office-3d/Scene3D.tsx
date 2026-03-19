import { OrbitControls, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { ZONES } from "@/lib/constants";
import { position2dTo3d } from "@/lib/position-allocator";
import { detectMeetingGroups } from "@/store/meeting-manager";
import { useOfficeStore } from "@/store/office-store";
import { AgentCharacter } from "./AgentCharacter";
import { Environment3D } from "./Environment3D";
import { OfficeLayout3D } from "./OfficeLayout3D";
import { ParentChildLine } from "./ParentChildLine";

const SCENE_CENTER: [number, number, number] = [8, 0, 6];
const BG_LIGHT = new THREE.Color("#e8ecf2");
const BG_DARK = new THREE.Color("#0f1729");

const MEETING_TABLE_CENTERS_2D = [
  { x: ZONES.meeting.x + ZONES.meeting.width / 2, y: ZONES.meeting.y + ZONES.meeting.height / 2 },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.25,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.3,
  },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.75,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.7,
  },
];

function MeetingLabels() {
  const agents = useOfficeStore((s) => s.agents);
  const links = useOfficeStore((s) => s.links);

  const groups = useMemo(() => detectMeetingGroups(links, agents), [links, agents]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <>
      {groups.map((group, i) => {
        const center = MEETING_TABLE_CENTERS_2D[i % MEETING_TABLE_CENTERS_2D.length];
        const [cx, , cz] = position2dTo3d(center);
        const names = group.agentIds.map((id) => agents.get(id)?.name ?? id.slice(0, 6)).join(", ");

        return (
          <Html
            key={group.sessionKey}
            position={[cx, 2, cz]}
            center
            transform={false}
            style={{ pointerEvents: "none" }}
          >
            <div className="pointer-events-none rounded bg-blue-600/80 px-2 py-1 text-[10px] text-white shadow whitespace-nowrap">
              {names}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function BackgroundSync() {
  const theme = useOfficeStore((s) => s.theme);
  const { gl } = useThree();
  const colorRef = useRef(new THREE.Color(theme === "light" ? BG_LIGHT : BG_DARK));

  useEffect(() => {
    gl.setClearColor(colorRef.current);
  }, [gl]);

  useFrame(() => {
    const target = theme === "light" ? BG_LIGHT : BG_DARK;
    colorRef.current.lerp(target, 0.05);
    gl.setClearColor(colorRef.current);
  });

  return null;
}

function SceneContent() {
  const agents = useOfficeStore((s) => s.agents);
  const theme = useOfficeStore((s) => s.theme);
  const bloomEnabled = useOfficeStore((s) => s.bloomEnabled);
  const agentList = Array.from(agents.values());

  return (
    <>
      <BackgroundSync />
      <OrbitControls
        enableRotate={true}
        enablePan={true}
        enableZoom={true}
        minPolarAngle={Math.PI / 8}
        maxPolarAngle={Math.PI / 2.8}
        minDistance={10}
        maxDistance={40}
        target={SCENE_CENTER}
        enableDamping
        dampingFactor={0.08}
      />
      <Environment3D theme={theme} />
      <OfficeLayout3D />
      {agentList.filter((a) => !a.isPlaceholder).map((agent) => (
        <AgentCharacter key={agent.id} agent={agent} />
      ))}
      {agentList
        .filter((a) => a.isSubAgent && a.parentAgentId && !a.isPlaceholder)
        .map((child) => {
          const parent = agents.get(child.parentAgentId!);
          if (!parent) {
            return null;
          }
          return <ParentChildLine key={`line-${child.id}`} parent={parent} child={child} />;
        })}
      <MeetingLabels />
      {bloomEnabled && (
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.6} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

export default function Scene3D() {
  return (
    <div className="h-full w-full">
      <Canvas
        gl={{ antialias: true, alpha: false }}
        shadows
        camera={{
          fov: 42,
          position: [22, 15, 22],
          near: 0.1,
          far: 200,
        }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
