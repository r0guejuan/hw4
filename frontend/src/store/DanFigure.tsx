/* eslint-disable react/immutability --
 * The idle animation (breathing, head turning toward the shopper) mutates three.js objects
 * inside react-three-fiber's frame loop, which runs outside React rendering. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { makeLabel } from './labels'

const FUR = '#f2e6d0'
const FUR_SHADE = '#e2d0b4'
const TAN = '#b07a4f'
const NAVY = '#0d2a52'
const INK = '#151515'

/**
 * A human-sized Handsome Dan (about 1.85 m), standing upright like a mascot: stocky white
 * bulldog, tan rose ears, heavy jowls, underbite, navy varsity jacket with a white Y and cream
 * sleeves, plus the headset from his chat avatar. He breathes and turns his head to follow
 * the shopper. Faces +z in local space.
 */
export default function DanFigure() {
  const head = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const world = useMemo(() => new THREE.Vector3(), [])
  const letter = useMemo(
    () => makeLabel([{ text: 'Y', size: 150, weight: 800, color: '#ffffff', font: 'serif' }], { width: 180, padding: 0 }),
    [],
  )

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    if (torso.current) torso.current.scale.set(1 + Math.sin(t * 1.6) * 0.012, 1 + Math.sin(t * 1.6) * 0.018, 1)
    if (armL.current) armL.current.rotation.z = 0.25 + Math.sin(t * 1.1) * 0.05
    if (head.current) {
      // turn toward the shopper (in the figure's local frame), within a natural range
      head.current.parent!.worldToLocal(world.copy(camera.position))
      const yaw = Math.atan2(world.x, world.z)
      const target = THREE.MathUtils.clamp(yaw, -0.7, 0.7)
      head.current.rotation.y += (target - head.current.rotation.y) * 0.06
      head.current.rotation.z = Math.sin(t * 0.9) * 0.04
      head.current.position.y = 1.55 + Math.sin(t * 1.6) * 0.008
    }
  })

  return (
    <group>
      {/* hind paws and stubby legs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.17, 0, 0]}>
          <mesh position={[0, 0.06, 0.06]} scale={[1, 0.55, 1.35]}>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color={FUR} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <capsuleGeometry args={[0.12, 0.3, 6, 12]} />
            <meshStandardMaterial color="#c9b48a" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* torso in a navy varsity jacket */}
      <group ref={torso} position={[0, 0.98, 0]}>
        <mesh scale={[1.12, 1, 0.85]}>
          <capsuleGeometry args={[0.34, 0.5, 8, 20]} />
          <meshStandardMaterial color={NAVY} roughness={0.75} />
        </mesh>
        {/* ribbed waistband and collar */}
        <mesh position={[0, -0.47, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.12, 0.85, 1]}>
          <torusGeometry args={[0.31, 0.04, 8, 32]} />
          <meshStandardMaterial color="#e9e0cc" />
        </mesh>
        <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]}>
          <torusGeometry args={[0.2, 0.05, 8, 28]} />
          <meshStandardMaterial color="#e9e0cc" />
        </mesh>
        {/* buttons and the chest Y */}
        {[0.25, 0.08, -0.09, -0.26].map((y) => (
          <mesh key={y} position={[0, y, 0.29]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color="#f4f1ea" />
          </mesh>
        ))}
        <mesh position={[0.17, 0.1, 0.285]} rotation={[0, 0.35, 0]}>
          <planeGeometry args={[0.24, 0.24]} />
          <meshBasicMaterial map={letter.texture} transparent toneMapped={false} />
        </mesh>
      </group>

      {/* arms: cream leather sleeves, paws out */}
      {[-1, 1].map((s) => (
        <group key={s} ref={s < 0 ? armL : undefined} position={[s * 0.42, 1.3, 0]} rotation={[0.15, 0, s * -0.25]}>
          <mesh position={[0, -0.28, 0]}>
            <capsuleGeometry args={[0.1, 0.38, 6, 12]} />
            <meshStandardMaterial color="#efe6d2" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.53, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.09, 0.03, 8, 20]} />
            <meshStandardMaterial color={NAVY} />
          </mesh>
          <mesh position={[0, -0.62, 0.02]}>
            <sphereGeometry args={[0.1, 14, 12]} />
            <meshStandardMaterial color={FUR} roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* the head */}
      <group ref={head} position={[0, 1.55, 0.02]}>
        {/* skull and cheeks: wide and flat-topped */}
        <mesh scale={[1.25, 0.95, 1.05]}>
          <sphereGeometry args={[0.24, 24, 18]} />
          <meshStandardMaterial color={FUR} roughness={0.95} />
        </mesh>
        {/* forehead wrinkles */}
        {[0.12, 0.16].map((y) => (
          <mesh key={y} position={[0, y, 0.19]} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.1, 0.008, 6, 20, Math.PI]} />
            <meshStandardMaterial color={FUR_SHADE} />
          </mesh>
        ))}
        {/* rose ears, tan */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.25, 0.14, 0.02]} rotation={[0.3, s * 0.4, s * -0.9]} scale={[1, 0.45, 0.8]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color={TAN} roughness={0.9} />
          </mesh>
        ))}
        {/* eyes with heavy brows */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.1, 0.04, 0.2]}>
            <mesh>
              <sphereGeometry args={[0.032, 12, 10]} />
              <meshStandardMaterial color="#4a2c18" roughness={0.3} />
            </mesh>
            <mesh position={[0.008, 0.01, 0.026]}>
              <sphereGeometry args={[0.008, 8, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0.035, 0.005]} rotation={[0, 0, s * 0.25]} scale={[1, 0.35, 0.6]}>
              <sphereGeometry args={[0.05, 10, 8]} />
              <meshStandardMaterial color={FUR_SHADE} />
            </mesh>
          </group>
        ))}
        {/* muzzle, nose roll, big black nose */}
        <mesh position={[0, -0.07, 0.17]} scale={[1.35, 0.8, 0.9]}>
          <sphereGeometry args={[0.13, 20, 14]} />
          <meshStandardMaterial color={FUR} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.0, 0.25]} rotation={[0.2, 0, 0]} scale={[1.6, 0.5, 0.6]}>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshStandardMaterial color={FUR_SHADE} />
        </mesh>
        <mesh position={[0, -0.04, 0.29]} scale={[1.4, 0.85, 0.8]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshStandardMaterial color={INK} roughness={0.35} />
        </mesh>
        {/* heavy jowls hanging either side */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1, -0.14, 0.19]} scale={[1, 1.15, 0.9]}>
            <sphereGeometry args={[0.085, 14, 12]} />
            <meshStandardMaterial color={FUR} roughness={0.95} />
          </mesh>
        ))}
        {/* the famous underbite: jutting lower jaw with little teeth */}
        <mesh position={[0, -0.2, 0.2]} scale={[1.2, 0.5, 0.8]}>
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshStandardMaterial color="#d99a95" roughness={0.7} />
        </mesh>
        {[-0.045, 0.045].map((x) => (
          <mesh key={x} position={[x, -0.165, 0.255]}>
            <coneGeometry args={[0.012, 0.035, 6]} />
            <meshStandardMaterial color="#fbf7ef" />
          </mesh>
        ))}
        {/* headset, like his chat avatar */}
        <mesh position={[0, 0.06, 0]} rotation={[0, 0, 0]} scale={[1.25, 1.05, 1]}>
          <torusGeometry args={[0.25, 0.018, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#1f2a44" metalness={0.3} roughness={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.31, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 20]} />
            <meshStandardMaterial color="#1f2a44" metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0.22, -0.12, 0.17]} rotation={[0.6, 0.6, 0.2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.22, 8]} />
          <meshStandardMaterial color="#1f2a44" />
        </mesh>
        <mesh position={[0.15, -0.19, 0.27]}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <meshStandardMaterial color="#1f2a44" />
        </mesh>
      </group>
    </group>
  )
}
