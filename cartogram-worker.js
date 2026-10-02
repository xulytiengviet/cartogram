import {meshFromRings,deform,soften} from './cartogram-engine.js';
self.onmessage=({data})=>{
 try{
  const result=deform(meshFromRings(data.items),{iterations:180,onProgress:progress=>self.postMessage({type:'progress',...progress})});
  self.postMessage({type:'result',result:soften(result)});
 }catch(error){self.postMessage({type:'error',message:error.message})}
};
