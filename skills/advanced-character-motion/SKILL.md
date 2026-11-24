---
name: advanced-character-motion
description: Modern character animation systems: motion matching, inertialization, IK and foot placement, procedural layers, physics-based and ragdoll blending, ML deformers and muscle simulation, motion capture cleanup, and the newest Unreal/Houdini toolsets. Use for game or film character animation systems and character FX.
---

# Advanced Character Motion

Reference: `code/vfx/motion.py` (`inertialize`, `MotionDatabase`).

## Motion matching
Instead of hand-built state machines, search a database of mocap every few frames
for the frame that best matches **(a)** the current pose (feet positions and
velocities, hip velocity) and **(b)** the desired future trajectory from
gameplay input. Then jump there.
- Features normalized per dimension and weighted (`MotionDatabase`).
- Acceleration: KD-trees, AABB hierarchies, or **Learned Motion Matching**
  (neural nets compress the database, Holden et al. 2020).
- **UE 5.7:** Motion Matching is integrated into Choosers via a Pose Search
  column (experimental); the Game Animation Sample Project (GASP) is the free
  reference setup.

## Inertialization
When switching animations, jump to the new pose immediately and decay the
offset (old − new) to zero with a quintic curve that ends with zero velocity and
acceleration (`inertialize`, Bollo GDC 2018). It's cheaper and cleaner than
crossfading, since the old animation is no longer evaluated. Spring-based variants
(critically damped) are common too.

## Procedural layers on top
- **Foot IK / foot placement:** raycast the ground, adjust the pelvis, two-bone IK
  per leg, lock feet during contact (UE 5.7 adds a Foot Placement Control Rig node).
- Look-at / aim (with joint limits), hand IK on props, lean into acceleration,
  breathing, and spring-driven secondary motion (ears, tails, gear).
- **Physics blending:** ragdoll for hits (partial physics with pose-matching
  motors). Houdini 21's motion mixer combines keyframes with ragdoll dynamics.

## Film character pipeline
- Rigs: procedural rig building (Houdini APEX/KineFX Autorig Builder, rig
  templates in H22), deformation via skinning + correctives + **ML deformers**
  (learn sim-quality deformation, run in real time).
- **Muscle and soft tissue:** Houdini 21's GPU Otis solver and Otto recipe;
  muscle transfer between characters.
- Mocap: solve, retarget (matching proportions; UE 5.7 keeps contacts relative
  to proportions), clean foot sliding with contact detection + IK.
- Splats: Houdini 22 can rig and animate Gaussian Splats like meshes.

## Exercises
1. Build features for a toy 2D character (trajectory points + foot velocities)
   from procedurally generated walk cycles and drive it with motion matching.
2. Compare crossfade vs inertialization on a sudden direction change; plot both.
3. Add foot locking with two-bone IK to the animation kit's `fabrik` arm.

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
