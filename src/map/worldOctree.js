import { Octree } from 'three/addons/math/Octree.js'

export function buildWorldOctree(mapGroup) {
  return new Octree().fromGraphNode(mapGroup)
}
