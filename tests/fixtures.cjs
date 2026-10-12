// Small deterministic geometry/images used only by the isolated regression server.
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
const stl = Buffer.from('solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 4 0 0\nvertex 0 3 2\nendloop\nendfacet\nendsolid test\n');
function gltf() {
 const vertices = Buffer.alloc(36);[0,0,0,4,0,0,0,3,2].forEach((n,i)=>vertices.writeFloatLE(n,i*4));
 return { asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{doubleSided:true}],buffers:[{byteLength:36,uri:'data:application/octet-stream;base64,'+vertices.toString('base64')}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36,target:34962}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[4,3,2]}] };
}
function glb() {
 const data=gltf(), vertices=Buffer.from(data.buffers[0].uri.split(',')[1],'base64');delete data.buffers[0].uri;
 const text=JSON.stringify(data),json=Buffer.from(text.padEnd(Math.ceil(Buffer.byteLength(text)/4)*4,' '));
 const buffer=Buffer.alloc(12+8+json.length+8+vertices.length);buffer.write('glTF');buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(json.length,12);buffer.writeUInt32LE(0x4e4f534a,16);json.copy(buffer,20);const offset=20+json.length;buffer.writeUInt32LE(vertices.length,offset);buffer.writeUInt32LE(0x004e4942,offset+4);vertices.copy(buffer,offset+8);return buffer;
}
function geotiff() {
 const tags=[[256,4,[2]],[257,4,[2]],[258,3,[8]],[259,3,[1]],[262,3,[1]],[273,4,[0]],[277,3,[1]],[278,4,[2]],[279,4,[4]],[284,3,[1]],[339,3,[1]], [33550,12,[0.0001,0.0001,0]], [33922,12,[0,0,0,153.088,-25.906,0]], [34735,3,[1,1,0,3,1024,0,1,2,1025,0,1,1,2048,0,1,4326]]];
 const sizes={3:2,4:4,12:8};let offset=8+2+tags.length*12+4;const buffer=Buffer.alloc(1024);buffer.write('II');buffer.writeUInt16LE(42,2);buffer.writeUInt32LE(8,4);buffer.writeUInt16LE(tags.length,8);
 tags.forEach(([id,type,values],i)=>{const at=10+i*12;buffer.writeUInt16LE(id,at);buffer.writeUInt16LE(type,at+2);buffer.writeUInt32LE(values.length,at+4);const bytes=values.length*sizes[type];const dest=bytes<=4?at+8:offset;if(bytes>4){buffer.writeUInt32LE(offset,at+8);offset+=bytes;}values.forEach((n,j)=>{const pos=dest+j*sizes[type];if(type===3)buffer.writeUInt16LE(n,pos);else if(type===4)buffer.writeUInt32LE(n,pos);else buffer.writeDoubleLE(n,pos);});});
 buffer.writeUInt32LE(offset,10+5*12+8);Buffer.from([20,100,180,250]).copy(buffer,offset);return buffer.subarray(0,offset+4);
}
module.exports={pixel,stl,gltf,glb,geotiff};
