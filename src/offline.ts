import Dexie, { type Table } from 'dexie'
export type OfflineDelivery={id:string;bookingId:string;workerId:string;createdAt:string;fullOut:number;emptyIn:number;remarks:string;state:'queued'|'synced-demo'|'conflict';message?:string}
class BlueFlameOfflineDb extends Dexie{
 deliveries!:Table<OfflineDelivery,string>
 constructor(){super('blue-flame-offline');this.version(1).stores({deliveries:'id, bookingId, state, createdAt'})}
}
const db=new BlueFlameOfflineDb()
export async function queueDelivery(item:OfflineDelivery){await db.deliveries.put(item)}
export async function pendingDeliveries(){return db.deliveries.where('state').equals('queued').toArray()}
export async function acknowledgeDemo(id:string){await db.deliveries.update(id,{state:'synced-demo',message:'Stored locally in demo mode; no server acknowledgement'})}
export async function clearOfflineData(){await db.deliveries.clear()}
