// Convert parser output into native Three r128 objects; no second viewer/store.
export function loadIFCModel(url, THREE, {signal, progress = () => {}} = {}) {
  return new Promise((resolve, reject) => {
    const group = new THREE.Group(), geometries = new Map(), materials = new Map();
    let worker, settled = false;
    const release = () => {
      worker?.terminate(); signal?.removeEventListener('abort', abort);
    };
    const fail = error => {
      if (settled) return;
      settled = true; release();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose()); group.clear();
      reject(error);
    };
    const abort = () => fail(new DOMException('IFC import cancelled.', 'AbortError'));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, {once:true});
    try {
      worker = new Worker(new URL('./ifc-worker.js', import.meta.url), {type:'module'});
      worker.onerror = event => { event.preventDefault(); fail(new Error('IFC parser could not run. Check your connection and use a current browser with WebAssembly support.')); };
      worker.onmessageerror = () => fail(new Error('IFC geometry could not be transferred to the viewer.'));
      worker.onmessage = ({data}) => {
        if (settled) return;
        try {
          if (data.type === 'status') progress(data.text);
          else if (data.type === 'error') fail(new Error(data.message));
          else if (data.type === 'mesh') {
            if (data.vertices) {
              const geometry = new THREE.BufferGeometry(); geometries.set(data.id, geometry);
              const buffer = new THREE.InterleavedBuffer(data.vertices, 6);
              geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
              geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
              geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
              geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            }
            const rgba = data.color, key = JSON.stringify(rgba);
            if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
              color:new THREE.Color(rgba.x, rgba.y, rgba.z), opacity:rgba.w,
              transparent:rgba.w < 1, side:THREE.DoubleSide, metalness:0.08, roughness:0.78
            }));
            const mesh = new THREE.Mesh(geometries.get(data.id), materials.get(key));
            // Preserve all per-instance placements and metre scaling; do not centre
            // individual parts or rotate IFC a second time at the root.
            mesh.matrix.fromArray(data.matrix); mesh.matrixAutoUpdate = false;
            group.add(mesh);
          } else if (data.type === 'done') {
            if (!group.children.length) throw new Error('No IFC geometry was loaded.');
            group.userData.ifc = {schema:data.schema, parts:data.parts, triangles:data.triangles};
            group.updateMatrixWorld(true); settled = true; release(); resolve(group);
          }
        } catch (error) { fail(error); }
      };
      worker.postMessage({url});
    } catch (error) { fail(error); }
  });
}
