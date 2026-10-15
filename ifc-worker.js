// Parser only: geometry is rendered by the existing Three.js viewer.
// Keep JS/WASM versions identical. Single-thread WASM works on GitHub Pages
// without cross-origin isolation, SharedArrayBuffer or a build/server step.
const PARSER = 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.78/';

self.onmessage = async ({data}) => {
  let api, modelId = -1;
  const status = text => self.postMessage({type:'status', text});
  try {
    status('Downloading IFC…');
    const response = await fetch(data.url);
    if (!response.ok) throw new Error('IFC download failed (HTTP ' + response.status + '). Check the URL and file access.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Reject HTML, RVT and unsupported schemas before allocating the parser.
    const header = new TextDecoder().decode(bytes.subarray(0, 65536));
    const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(header)?.[1]?.toUpperCase();
    if (!/^\s*ISO-10303-21\s*;/i.test(header) || !schema) throw new Error('Invalid IFC file: expected an IFC STEP header. Export .ifc from Revit; native .rvt is not supported.');
    if (!['IFC2X3','IFC4'].includes(schema)) throw new Error('Unsupported IFC schema: ' + schema + '. Export IFC2x3 or IFC4.');
    status('Preparing IFC parser…');
    const {IfcAPI} = await import(PARSER + 'web-ifc-api.js');
    api = new IfcAPI(); api.SetWasmPath(PARSER, true);
    await api.Init(undefined, true);
    status('Reading ' + schema + ' geometry…');
    modelId = api.OpenModel(bytes, {COORDINATE_TO_ORIGIN:false, ALLOW_INCOMPATIBLE_SCHEMA_ALIASES:false});
    if (modelId < 0 || !api.IsModelOpen(modelId)) throw new Error('The IFC parser could not open this file. Check the Revit export.');
    const sent = new Set(); let parts = 0, triangles = 0;
    api.StreamAllMeshes(modelId, flatMesh => {
      for (let i = 0; i < flatMesh.geometries.size(); i++) {
        const placed = flatMesh.geometries.get(i), id = placed.geometryExpressID;
        const color = placed.color;
        const message = {type:'mesh', id, matrix:Array.from(placed.flatTransformation), color:{x:color.x,y:color.y,z:color.z,w:color.w}};
        const transfer = [];
        if (!sent.has(id)) {
          const geometry = api.GetGeometry(modelId, id);
          try {
            const vertices = new Float32Array(api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize()));
            const indices = new Uint32Array(api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize()));
            if (!vertices.length || !indices.length) continue;
            if (vertices.length % 6 || indices.length % 3 || !vertices.every(Number.isFinite) || indices.some(n => n >= vertices.length / 6)) throw new Error('Invalid IFC mesh geometry. Try exporting the model again.');
            message.vertices = vertices; message.indices = indices;
            transfer.push(vertices.buffer, indices.buffer); sent.add(id);
            triangles += indices.length / 3;
          } finally { geometry.delete(); }
        }
        if (message.matrix.length !== 16 || !message.matrix.every(Number.isFinite)) throw new Error('Invalid IFC placement transform.');
        self.postMessage(message, transfer);
        parts++;
        if (parts % 100 === 0) status('Building IFC geometry: ' + parts + ' parts…');
      }
    }, true); // web-ifc applies IFC length units and its IFC Z-up → Three Y-up transform.
    if (!parts) throw new Error('No supported renderable geometry found in this IFC. Export a 3D IFC2x3/IFC4 model.');
    self.postMessage({type:'done', schema:api.GetModelSchema(modelId), parts, triangles});
  } catch (error) {
    self.postMessage({type:'error', message:error.message || 'IFC import failed.'});
  } finally {
    try { if (api && modelId >= 0 && api.IsModelOpen(modelId)) api.CloseModel(modelId); } catch (_) {}
    try { api?.Dispose(); } catch (_) {}
    self.close();
  }
};
