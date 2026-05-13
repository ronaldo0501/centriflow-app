'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import StatusPill from '@/components/StatusPill';
import { Loader2, Layers } from 'lucide-react';

interface MapDevice {
  id: string;
  tag_number: string;
  assembly_type: string;
  size: string;
  last_test_result: string;
  next_test_due: string;
  address_line1: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    require: any;
  }
}

const STATUS_COLOR: Record<string, [number, number, number]> = {
  pass: [34, 197, 94],
  fail: [239, 68, 68],
  not_tested: [156, 163, 175],
};

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<MapDevice[]>([]);
  const [selected, setSelected] = useState<MapDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail' | 'not_tested'>('all');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);

  useEffect(() => {
    api.get('/api/v1/devices?per_page=500&status=active')
      .then(res => {
        const withCoords = (res.data as MapDevice[]).filter(d => d.lat && d.lng);
        setDevices(withCoords);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

    const script = document.createElement('script');
    script.src = 'https://js.arcgis.com/4.29/';
    script.async = true;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css';

    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      window.require([
        'esri/Map',
        'esri/views/MapView',
        'esri/layers/GraphicsLayer',
        'esri/Graphic',
        'esri/geometry/Point',
        'esri/symbols/SimpleMarkerSymbol',
        'esri/config',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ], (Map: any, MapView: any, GraphicsLayer: any, Graphic: any, Point: any, SimpleMarkerSymbol: any, esriConfig: any) => {
        if (apiKey) esriConfig.apiKey = apiKey;

        const map = new Map({ basemap: 'streets-navigation-vector' });
        const view = new MapView({
          container: mapRef.current,
          map,
          zoom: 11,
          center: [-111.8, 40.7],
        });
        viewRef.current = view;

        const layer = new GraphicsLayer();
        layerRef.current = { layer, Graphic, Point, SimpleMarkerSymbol };
        map.add(layer);

        const addGraphics = (devs: MapDevice[]) => {
          layer.removeAll();
          devs.forEach(d => {
            if (!d.lat || !d.lng) return;
            const color = STATUS_COLOR[d.last_test_result] || STATUS_COLOR.not_tested;
            const g = new Graphic({
              geometry: new Point({ longitude: d.lng, latitude: d.lat }),
              symbol: new SimpleMarkerSymbol({ color, size: 10, outline: { color: [255, 255, 255], width: 1.5 } }),
              attributes: d,
              popupTemplate: {
                title: `{tag_number}`,
                content: `{address_line1}, {city}, {state}<br/>Type: {assembly_type} · {size}<br/>Last result: {last_test_result}`,
              },
            });
            layer.add(g);
          });
        };

        addGraphics(devices);

        view.on('click', (event: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          view.hitTest(event as any).then((response: any) => {
            const result = response.results[0];
            if (result?.graphic?.attributes?.id) {
              setSelected(result.graphic.attributes as MapDevice);
            } else {
              setSelected(null);
            }
          });
        });

        setMapReady(true);
      });
    };

    return () => {
      document.head.removeChild(script);
      document.head.removeChild(link);
      if (viewRef.current) viewRef.current.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (!mapReady || !layerRef.current) return;
    const { layer, Graphic, Point, SimpleMarkerSymbol } = layerRef.current;
    const filtered = filter === 'all' ? devices : devices.filter(d => d.last_test_result === filter);
    layer.removeAll();
    filtered.forEach((d: MapDevice) => {
      if (!d.lat || !d.lng) return;
      const color = STATUS_COLOR[d.last_test_result] || STATUS_COLOR.not_tested;
      layer.add(new Graphic({
        geometry: new Point({ longitude: d.lng, latitude: d.lat }),
        symbol: new SimpleMarkerSymbol({ color, size: 10, outline: { color: [255, 255, 255], width: 1.5 } }),
        attributes: d,
        popupTemplate: {
          title: `{tag_number}`,
          content: `{address_line1}, {city}, {state}<br/>Type: {assembly_type} · {size}<br/>Last result: {last_test_result}`,
        },
      }));
    });
  }, [filter, devices, mapReady]);

  const filteredCount = filter === 'all' ? devices.length : devices.filter(d => d.last_test_result === filter).length;

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <PageHeader title="Device Map" subtitle={`${filteredCount} devices shown`} />
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" />
          {(['all', 'pass', 'fail', 'not_tested'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {(loading || !mapReady) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{loading ? 'Loading devices...' : 'Initializing map...'}</p>
              </div>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />

          {/* Legend */}
          <div className="absolute bottom-6 left-4 bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-xs space-y-1.5">
            {[['pass', 'Pass', 'bg-green-500'], ['fail', 'Fail', 'bg-red-500'], ['not_tested', 'Not tested', 'bg-gray-400']].map(([, label, cls]) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${cls}`} />
                <span className="text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="w-72 border-l border-gray-200 bg-white p-5 overflow-y-auto flex-shrink-0">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-lg">{selected.tag_number}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <StatusPill status={selected.last_test_result} />
            <div className="mt-4 space-y-2 text-sm">
              <div><p className="text-gray-400 text-xs">Address</p><p className="text-gray-700">{selected.address_line1}, {selected.city}, {selected.state}</p></div>
              <div><p className="text-gray-400 text-xs">Assembly</p><p className="text-gray-700">{selected.assembly_type} · {selected.size}</p></div>
              <div><p className="text-gray-400 text-xs">Next Test Due</p><p className="text-gray-700">{selected.next_test_due ? new Date(selected.next_test_due).toLocaleDateString() : '—'}</p></div>
            </div>
            <a
              href={`/devices/${selected.id}`}
              className="mt-5 block w-full text-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              View Device Detail
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
