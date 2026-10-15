// Parser only: geometry is rendered by the existing Three.js viewer.
// Keep JS/WASM versions identical. Single-thread WASM works on GitHub Pages
// without cross-origin isolation, SharedArrayBuffer or a build/server step.
const PARSER = 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.78/';

// Read schema entities through the pinned parser, never through a file-specific index.
// Numeric IFC wrappers expose value through a getter; copy it explicitly before
// structured cloning so numbers, booleans and nulls keep their recorded types.
const valueOf = value => value == null ? null : Array.isArray(value) ? value.map(valueOf) :
  typeof value === 'object' && 'value' in value ? value.value : value;
const identity = () => [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

function readMetadata(api, modelId, IFC) {
  const read = id => api.GetLine(modelId, typeof id === 'number' ? id : id?.value);
  const ids = type => {
    if (!type) return [];
    const vector = api.GetLineIDsWithType(modelId, type, true);
    return Array.from({length:vector.size()}, (_, i) => vector.get(i));
  };
  const className = type => api.GetNameFromTypeCode(type).toUpperCase();
  const warnings = [], excludedElements = [];
  const features = new Set(ids(IFC.IFCFEATUREELEMENT));
  const spatial = new Set([...ids(IFC.IFCSPATIALELEMENT), ...ids(IFC.IFCSPATIALSTRUCTUREELEMENT)]);
  const records = new Map(), elements = [];
  for (const expressID of ids(IFC.IFCPRODUCT)) {
    const entity = read(expressID);
    const summary = {expressID, globalId:valueOf(entity.GlobalId), name:valueOf(entity.Name) || '', ifcClass:className(entity.type)};
    if (features.has(expressID) || (spatial.has(expressID) && !entity.Representation)) {
      // Openings are subtraction operands, not additional visible solids.
      excludedElements.push({...summary, reason:entity.type === IFC.IFCOPENINGELEMENT ? 'Opening/void used by host geometry' : 'Spatial container or feature used by other geometry'});
      continue;
    }
    const element = {...summary, properties:{}, propertyTypes:{}, groups:[], status:null, category:null, phase:null, display:null};
    records.set(expressID, {entity, element}); elements.push(element);
  }

  function unitOf(handle) {
    if (!handle) return null;
    const unit = read(handle);
    return {expressID:unit.expressID, ifcClass:className(unit.type), name:valueOf(unit.Name), prefix:valueOf(unit.Prefix), unitType:valueOf(unit.UnitType)};
  }
  function propertyOf(property) {
    let value = null, source = null;
    if ('NominalValue' in property) source = property.NominalValue;
    else if ('EnumerationValues' in property) source = property.EnumerationValues;
    else if ('ListValues' in property) source = property.ListValues;
    else if ('LowerBoundValue' in property) source = {lower:valueOf(property.LowerBoundValue), upper:valueOf(property.UpperBoundValue), setPoint:valueOf(property.SetPointValue)};
    else if ('DefiningValues' in property) source = {defining:valueOf(property.DefiningValues), defined:valueOf(property.DefinedValues)};
    else if (property.HasProperties) {
      source = Object.fromEntries(property.HasProperties.map(ref => {const child=read(ref); return [valueOf(child.Name), propertyOf(child).value];}));
    } else {
      const key = Object.keys(property).find(key => /Value$/.test(key));
      if (key) source = property[key];
    }
    value = valueOf(source);
    const type = {expressID:property.expressID, ifcClass:className(property.type), ifcType:source?.name || null, unit:unitOf(property.Unit)};
    if (source && typeof source === 'object' && '_internalValue' in source) type.recordedValue = source._internalValue;
    if (Array.isArray(source)) type.valueTypes = source.map(item => item?.name || null);
    return {value, type};
  }
  const propertySets = new Map();
  function propertySetOf(ref) {
    if (propertySets.has(ref.value)) return propertySets.get(ref.value);
    const pset = read(ref), properties = {}, types = {};
    for (const propRef of pset.HasProperties || pset.Quantities || []) {
      const property=read(propRef), result=propertyOf(property), name=valueOf(property.Name);
      Object.defineProperty(properties, name, {value:result.value, enumerable:true, configurable:true});
      Object.defineProperty(types, name, {value:result.type, enumerable:true, configurable:true});
    }
    const result = {name:valueOf(pset.Name) || className(pset.type), properties, types};
    propertySets.set(ref.value, result); return result;
  }
  for (const id of ids(IFC.IFCRELDEFINESBYPROPERTIES)) {
    const relation = read(id);
    for (const ref of [].concat(relation.RelatingPropertyDefinition || [])) {
      try {
        const pset = propertySetOf(ref);
        for (const object of relation.RelatedObjects || []) {
          const element = records.get(object.value)?.element;
          if (!element) continue;
          Object.defineProperty(element.properties, pset.name, {value:pset.properties, enumerable:true, configurable:true});
          Object.defineProperty(element.propertyTypes, pset.name, {value:pset.types, enumerable:true, configurable:true});
        }
      } catch (error) { warnings.push('Property relationship #' + id + ': ' + error.message); }
    }
  }
  for (const element of elements) {
    const construction = element.properties.Pset_ConstructionStatus || {};
    for (const key of ['Status','Category','Phase','Display']) element[key.toLowerCase()] = construction[key] ?? null;
  }
  const groups = ids(IFC.IFCGROUP).map(id => {
    const group=read(id); return {expressID:id, globalId:valueOf(group.GlobalId), name:valueOf(group.Name) || '', elementIds:[]};
  });
  const groupsById = new Map(groups.map(group => [group.expressID, group]));
  for (const id of ids(IFC.IFCRELASSIGNSTOGROUP)) {
    const relation=read(id), group=groupsById.get(relation.RelatingGroup?.value);
    if (!group) continue;
    for (const ref of relation.RelatedObjects || []) {
      const element=records.get(ref.value)?.element;
      if (!element) continue;
      if (!element.groups.includes(group.expressID)) element.groups.push(group.expressID);
      if (!group.elementIds.includes(element.globalId)) group.elementIds.push(element.globalId);
    }
  }

  const prefixes = {EXA:1e18,PETA:1e15,TERA:1e12,GIGA:1e9,MEGA:1e6,KILO:1e3,HECTO:1e2,DECA:1e1,DECI:1e-1,CENTI:1e-2,MILLI:1e-3,MICRO:1e-6,NANO:1e-9,PICO:1e-12,FEMTO:1e-15,ATTO:1e-18};
  function metresPerUnit(ref, seen = new Set()) {
    if (!ref || seen.has(ref.value)) return null;
    seen.add(ref.value);
    const unit=read(ref);
    if (unit.type === IFC.IFCSIUNIT && valueOf(unit.Name) === 'METRE') return unit.Prefix ? prefixes[valueOf(unit.Prefix)] ?? null : 1;
    if (unit.ConversionFactor) {
      const factor=read(unit.ConversionFactor), base=metresPerUnit(factor.UnitComponent, seen), amount=valueOf(factor.ValueComponent);
      return base != null && typeof amount === 'number' && amount > 0 ? amount * base : null;
    }
    return null;
  }
  const project = ids(IFC.IFCPROJECT).map(read)[0];
  const units = project?.UnitsInContext ? read(project.UnitsInContext).Units : [];
  const lengthRef = (units || []).find(ref => valueOf(read(ref).UnitType) === 'LENGTHUNIT');
  const lengthUnit = unitOf(lengthRef), lengthScale = metresPerUnit(lengthRef);
  const unitName=lengthUnit?.name === 'METRE' ? (lengthUnit.prefix || '').toLowerCase()+'metre' : lengthUnit?.name || null;
  const coordinateSystem = {crs:null, verticalDatum:null, unit:unitName, lengthUnit, metresPerUnit:lengthScale, mapConversion:null, ahdVerified:false};
  const conversions = ids(IFC.IFCMAPCONVERSION);
  if (conversions.length === 1) {
    const conversion=read(conversions[0]), target=read(conversion.TargetCRS), source=read(conversion.SourceCRS);
    coordinateSystem.crs=valueOf(target.Name); coordinateSystem.verticalDatum=valueOf(target.VerticalDatum);
    coordinateSystem.mapConversion={expressID:conversion.expressID, eastings:valueOf(conversion.Eastings), northings:valueOf(conversion.Northings), orthogonalHeight:valueOf(conversion.OrthogonalHeight), scale:valueOf(conversion.Scale) ?? 1, xAxisAbscissa:valueOf(conversion.XAxisAbscissa) ?? 1, xAxisOrdinate:valueOf(conversion.XAxisOrdinate) ?? 0};
    const map=coordinateSystem.mapConversion, placement=source.WorldCoordinateSystem ? read(source.WorldCoordinateSystem) : null;
    const direction = (ref, fallback) => ref ? read(ref).DirectionRatios.map(valueOf) : fallback;
    const axis=placement ? direction(placement.Axis,[0,0,1]) : [], xAxis=placement ? direction(placement.RefDirection,[1,0,0]) : [];
    const origin=placement?.Location ? read(placement.Location).Coordinates.map(valueOf) : [];
    const equal = (a,b) => a.length === b.length && a.every((n,i) => Math.abs(n-b[i]) < 1e-10);
    // The viewer reports local Three Y in metres. Only label it AHD when the
    // IFC itself verifies the simple local-height + map-height relationship.
    coordinateSystem.ahdVerified = /^AHD$/i.test(coordinateSystem.verticalDatum || '') && lengthScale === 1 && metresPerUnit(target.MapUnit) === 1 &&
      [map.eastings,map.northings,map.orthogonalHeight].every(Number.isFinite) && map.scale === 1 && map.xAxisAbscissa === 1 && map.xAxisOrdinate === 0 &&
      equal(axis,[0,0,1]) && equal(xAxis,[1,0,0]) && equal(origin,[0,0,0]);
  }
  return {elements, groups, coordinateSystem, records, read, ids, className, lengthScale, warnings, excludedElements};
}

// web-ifc's triangle stream does not emit IfcGeometricCurveSet. Retain original
// polyline vertices as line segments; do not invent solids or chord curved IFCs.
function streamPolylines(api, modelId, IFC, metadata, rendered) {
  const {read, ids, records, lengthScale, className}=metadata;
  const styles=new Map(), issues=new Map(), elementIds=new Set(); let parts=0, segments=0;
  for (const id of ids(IFC.IFCSTYLEDITEM)) {
    const style=read(id); if (style.Item) styles.set(style.Item.value,style.Styles || []);
  }
  function colorOf(id, seen=new Set()) {
    if (seen.has(id)) return null; seen.add(id);
    const entity=read(id);
    if (entity.type === IFC.IFCCOLOURRGB) return {x:valueOf(entity.Red), y:valueOf(entity.Green), z:valueOf(entity.Blue), w:1};
    for (const ref of [entity.CurveColour, entity.SurfaceColour, ...(entity.Styles || []), ...(styles.get(id) || [])].filter(Boolean)) {
      const color=colorOf(ref.value,seen); if (color) return color;
    }
    return null;
  }
  for (const [expressID,{entity}] of records) {
    if (!entity.Representation) continue;
    const representations=read(entity.Representation).Representations || [];
    for (const representationRef of representations) {
      const representation=read(representationRef), kind=valueOf(representation.RepresentationType);
      if (!['GeometricCurveSet','Curve2D','Curve3D'].includes(kind)) continue;
      const unsupported=new Set(), positions=[];
      const transform=entity.ObjectPlacement ? api.GetWorldTransformMatrix(modelId,entity.ObjectPlacement.value) : identity();
      if (!lengthScale || transform.length !== 16 || !transform.every(Number.isFinite)) { issues.set(expressID,['Unknown length unit or invalid curve placement']); continue; }
      const point = ref => {
        const c=read(ref).Coordinates.map(valueOf), x=c[0], y=c[1], z=c[2] ?? 0;
        if (![x,y,z].every(Number.isFinite)) throw new Error('Invalid IFC polyline coordinate.');
        const X=(transform[0]*x+transform[4]*y+transform[8]*z+transform[12])*lengthScale;
        const Y=(transform[1]*x+transform[5]*y+transform[9]*z+transform[13])*lengthScale;
        const Z=(transform[2]*x+transform[6]*y+transform[10]*z+transform[14])*lengthScale;
        return [X,Z,-Y]; // Same metre / Z-up to Y-up conversion as StreamAllMeshes.
      };
      function visit(ref, seen=new Set()) {
        if (seen.has(ref.value)) return; seen.add(ref.value);
        const item=read(ref);
        if (item.type === IFC.IFCGEOMETRICCURVESET) for (const child of item.Elements || []) visit(child,seen);
        else if (item.type === IFC.IFCPOLYLINE) {
          const points=(item.Points || []).map(point);
          for (let i=1;i<points.length;i++) positions.push(...points[i-1],...points[i]);
        } else unsupported.add(className(item.type));
      }
      for (const item of representation.Items || []) visit(item);
      if (unsupported.size) issues.set(expressID,[...unsupported]);
      if (!positions.length) continue;
      const vertices=new Float32Array(positions);
      if (!vertices.every(Number.isFinite)) throw new Error('Invalid IFC polyline geometry.');
      const color=(representation.Items || []).map(ref=>colorOf(ref.value)).find(Boolean) || {x:.55,y:.6,z:.65,w:1};
      self.postMessage({type:'lines',id:representation.expressID,expressID,positions:vertices,color},[vertices.buffer]);
      rendered.add(expressID); elementIds.add(expressID); parts++; segments+=positions.length/6;
    }
  }
  return {parts,segments,issues,elementIds};
}

self.onmessage = async ({data}) => {
  let api, modelId = -1;
  const parserWarnings=[], originalConsole={}; let parserWarningCount=0;
  const status = text => self.postMessage({type:'status', text});
  try {
    // 0.0.78 has no public diagnostic queue. Its WASM logger writes tagged
    // errors to stdout as well as stderr. Keep console output intact and retain
    // a bounded sample; face IDs in these logs are not necessarily product IDs.
    for (const method of ['log','warn','error']) {
      originalConsole[method]=console[method];
      console[method]=(...args) => {
        const text=args.map(arg=>String(arg)).join(' ');
        if (method !== 'log' || /\[WEB-IFC\].*\[(?:error|warn(?:ing)?)\]/i.test(text)) {
          parserWarningCount++;
          if (parserWarnings.length < 20) parserWarnings.push(text.slice(0,600));
        }
        originalConsole[method].apply(console,args);
      };
    }
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
    const IFC = await import(PARSER + 'web-ifc-api.js');
    const {IfcAPI} = IFC;
    api = new IfcAPI(); api.SetWasmPath(PARSER, true);
    await api.Init(undefined, true);
    status('Reading ' + schema + ' geometry…');
    modelId = api.OpenModel(bytes, {COORDINATE_TO_ORIGIN:false, ALLOW_INCOMPATIBLE_SCHEMA_ALIASES:false});
    if (modelId < 0 || !api.IsModelOpen(modelId)) throw new Error('The IFC parser could not open this file. Check the Revit export.');
    status('Reading IFC properties and groups…');
    const metadata=readMetadata(api, modelId, IFC);
    const digest=crypto.subtle ? await crypto.subtle.digest('SHA-256',bytes) : null;
    const contentHash=digest ? Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('') : null;
    if(!contentHash)metadata.warnings.push('Use HTTPS or localhost for file-verified preset matching and persistent saved views. Inspection remains available this session.');
    self.postMessage({type:'metadata',elements:metadata.elements,groups:metadata.groups,coordinateSystem:metadata.coordinateSystem,contentHash});
    const sent = new Set(), rendered=new Set(), meshElements=new Set(); let parts = 0, triangles = 0;
    api.StreamAllMeshes(modelId, flatMesh => {
      if (!metadata.records.has(flatMesh.expressID)) return;
      for (let i = 0; i < flatMesh.geometries.size(); i++) {
        const placed = flatMesh.geometries.get(i), id = placed.geometryExpressID;
        const color = placed.color;
        const message = {type:'mesh', id, expressID:flatMesh.expressID, matrix:Array.from(placed.flatTransformation), color:{x:color.x,y:color.y,z:color.z,w:color.w}};
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
        rendered.add(flatMesh.expressID); meshElements.add(flatMesh.expressID);
        parts++;
        if (parts % 100 === 0) status('Building IFC geometry: ' + parts + ' parts…');
      }
    }, true); // web-ifc applies IFC length units and its IFC Z-up → Three Y-up transform.
    const lines=streamPolylines(api,modelId,IFC,metadata,rendered);
    parts+=lines.parts;
    const unsupportedElements=metadata.elements.filter(element=>!rendered.has(element.expressID) || lines.issues.has(element.expressID)).map(element=>({
      expressID:element.expressID,globalId:element.globalId,name:element.name,ifcClass:element.ifcClass,
      reason:lines.issues.has(element.expressID) ? 'Unsupported curve representation: '+lines.issues.get(element.expressID).join(', ') : 'No supported geometry emitted by the IFC parser',
      partiallyRendered:rendered.has(element.expressID)
    }));
    const diagnostics={elementCount:metadata.elements.length,renderedElementCount:rendered.size,meshElementCount:meshElements.size,lineElementCount:lines.elementIds.size,unsupportedElements,excludedElements:metadata.excludedElements,warnings:[...metadata.warnings,...parserWarnings],parserWarningCount,parserWarningsTruncated:parserWarningCount > parserWarnings.length};
    if (!parts) throw new Error('No supported renderable geometry found in this IFC. Export a 3D IFC2x3/IFC4 model.');
    self.postMessage({type:'done', schema:api.GetModelSchema(modelId), parts, triangles, lineSegments:lines.segments, diagnostics});
  } catch (error) {
    self.postMessage({type:'error', message:error.message || 'IFC import failed.'});
  } finally {
    try { if (api && modelId >= 0 && api.IsModelOpen(modelId)) api.CloseModel(modelId); } catch (_) {}
    try { api?.Dispose(); } catch (_) {}
    for (const [method,original] of Object.entries(originalConsole)) console[method]=original;
    self.close();
  }
};
