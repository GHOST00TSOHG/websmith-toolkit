---
name: gpu-and-performance
description: Making effects code fast: NumPy vectorization patterns, multiprocessing frame rendering, profiling, memory layout, and moving to the GPU with NVIDIA Warp, Taichi, CuPy/PyTorch or shaders (moderngl). Use when a simulation or render is too slow or needs to scale up.
---

# GPU & Performance for Effects Code

## Ladder of speed (climb only as far as needed)
1. **Profile first:** `python -m cProfile -s cumtime`, `line_profiler`. Fix the
   hot loop, not your guess.
2. **Vectorize with NumPy:** process all pixels, rays or particles at once (`sdf.py`
   marches every ray in one array). Use boolean masks for active subsets,
   `np.add.at` for scatter-adds (`splat_points`), and avoid Python loops over elements.
3. **Parallelize independent frames:** `ProcessPoolExecutor().map` (as in
   `sdf_morph.py`): near-linear speedup with cores. Simulations are sequential, but
   their renders aren't.
4. **JIT on CPU:** Numba `@njit(parallel=True)` for loops that won't vectorize
   (Gauss-Seidel, neighbour searches).
5. **GPU:**
   - **NVIDIA Warp:** write kernels in Python, JIT to CUDA; built-in
     meshes, BVHs, sparse volumes, FEM; **differentiable**; CUDA-graph capture
     removes launch overhead. Basis of the Newton physics engine.
   - **Taichi:** similar kernel model, also on Vulkan/Metal; famous compact MPM.
   - **CuPy / PyTorch:** a near drop-in NumPy replacement on the GPU (`import cupy as np`
     style) for array-style code.
   - **Shaders (moderngl, WebGL):** for image-space effects and raymarching.

## Patterns that matter on GPUs
- **Graph coloring** for constraint solves (`xpbd.py`): parallel without races.
- **Spatial hashing** for neighbours (SPH, self-collision, boids): sort particles
  by cell index, then scan neighbouring cells.
- Structure-of-arrays memory layout; keep data on the GPU across steps; batch
  small kernels.
- Sparse data (VDB/NanoVDB) when only a fraction of the domain is active.
- Use float32 on GPUs, with care for accumulations (Kahan sums or float64 where needed).

## Caching and pipelines
Simulate once, save every frame (npz, VDB, Alembic, USD), and render or retime
from the cache. Distribute renders (OpenCue, Deadline, Houdini PDG) across machines.

## Exercises
1. Profile `demos/smoke_fire.py`: which function dominates? Speed up `project()`
   with a multigrid V-cycle or a Numba kernel.
2. Port `Smoke2D.advect` to Warp or Taichi and compare at 1024².
3. Write the SDF scene as a GLSL fragment shader with moderngl and render 4K frames.

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
