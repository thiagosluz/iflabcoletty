import { useState, useEffect } from 'react';
import {
    DndContext,
    useDraggable,
    useDroppable,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Monitor, Save, Edit3, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import apiClient from '@/lib/axios';
import { isComputerOnline } from '@/lib/utils';

interface Computer {
    id: number;
    hostname: string | null;
    machine_id: string;
    position_x?: number;
    position_y?: number;
    updated_at: string;
}

interface LabMapProps {
    labId: string;
    computers: Computer[];
    onUpdate: () => Promise<Computer[]> | void;
}

function DraggableComputer({ computer, isEditing, style }: { computer: Computer, isEditing: boolean, style: any }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: computer.id,
        data: computer,
        disabled: !isEditing,
    });

    // Use shared utility function for consistency
    const isOnline = (dateStr: string) => isComputerOnline(dateStr, 5);

    const finalStyle = {
        ...style,
        left: `${computer.position_x || 0}%`,
        top: `${computer.position_y || 0}%`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        position: 'absolute' as 'absolute',
    };

    return (
        <div
            ref={setNodeRef}
            style={finalStyle}
            {...listeners}
            {...attributes}
            className={`flex flex-col items-center group ${isEditing ? 'cursor-move z-20' : 'cursor-pointer z-10'}`}
        >
            <div className={`
                w-12 h-12 rounded-lg flex items-center justify-center shadow-md transition-colors
                ${isOnline(computer.updated_at) ? 'bg-green-100 border-green-500' : 'bg-gray-100 border-gray-400'}
                border-2
            `}>
                <Monitor className={`h-6 w-6 ${isOnline(computer.updated_at) ? 'text-green-600' : 'text-gray-500'}`} />
            </div>
            <span className="mt-1 text-xs font-medium bg-white/80 px-2 rounded shadow-sm whitespace-nowrap">
                {computer.hostname || computer.machine_id.substring(0, 8)}
            </span>
        </div>
    );
}

export default function LabMap({ labId, computers: initialComputers, onUpdate }: LabMapProps) {
    const [computers, setComputers] = useState<Computer[]>(initialComputers);
    const [isEditing, setIsEditing] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { toast } = useToast();

    // Sensors for better drag control
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    useEffect(() => {
        setComputers(initialComputers);
    }, [initialComputers]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta } = event;
        const id = active.id;

        // Calculate new percentage based on parent container
        // We need the container dimensions to convert pixels (delta) to percentage
        // But in dnd-kit context, we usually update state.

        // Simplified approach: Update temporary state with pixels? 
        // Better: We need to get the drop container dimensions.
        const container = document.getElementById('lab-map-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const deltaXPercent = (delta.x / rect.width) * 100;
        const deltaYPercent = (delta.y / rect.height) * 100;

        setComputers(prev => prev.map(comp => {
            if (comp.id === id) {
                let newX = (comp.position_x || 0) + deltaXPercent;
                let newY = (comp.position_y || 0) + deltaYPercent;

                // Clamp
                newX = Math.max(0, Math.min(95, newX));
                newY = Math.max(0, Math.min(90, newY)); // 90 to leave room for label

                return { ...comp, position_x: newX, position_y: newY };
            }
            return comp;
        }));
        setHasChanges(true);
    };

    const savePositions = async () => {
        try {
            const positions = computers.reduce((acc, comp) => {
                acc[comp.id] = {
                    x: Math.round(comp.position_x || 0),
                    y: Math.round(comp.position_y || 0)
                };
                return acc;
            }, {} as Record<number, { x: number, y: number }>);

            await apiClient.post(`/labs/${labId}/positions`, { positions });

            toast({
                title: "Layout salvo",
                description: "As posições dos computadores foram atualizadas.",
            });
            setIsEditing(false);
            setHasChanges(false);
            
            // Refetch parent data and update local state with fresh data
            const updatedComputers = await onUpdate();
            if (updatedComputers && Array.isArray(updatedComputers)) {
                setComputers(updatedComputers);
            }
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar o layout.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="bg-white shadow rounded-lg p-6 flex flex-col h-[600px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Mapa Visual</h3>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setComputers(initialComputers); }} title="Cancelar">
                                <X className="h-4 w-4 mr-2" /> Cancelar
                            </Button>
                            <Button size="sm" onClick={savePositions} disabled={!hasChanges} className="bg-green-600 hover:bg-green-700">
                                <Save className="h-4 w-4 mr-2" /> Salvar Layout
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                            <Edit3 className="h-4 w-4 mr-2" /> Editar Layout
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg relative overflow-hidden select-none" id="lab-map-container">
                {/* Grid Pattern Background */}
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />

                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    {computers.map(computer => (
                        <DraggableComputer
                            key={computer.id}
                            computer={computer}
                            isEditing={isEditing}
                            style={{}}
                        />
                    ))}
                </DndContext>

                {computers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        Nenhum computador neste laboratório.
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
                {isEditing
                    ? "Arraste os computadores para posicioná-los na sala representando o layout real."
                    : "Visualize o status dos computadores em tempo real no mapa da sala."}
            </p>
        </div>
    );
}
