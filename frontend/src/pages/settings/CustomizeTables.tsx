import { Plus, ChevronLeft, Trash2 } from 'lucide-react';
import { useSettings, type Floor, type Section, type RestaurantTable } from '../../hooks/useSettings';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

// --- HELPER FUNCTIONS FOR AUTO-INCREMENTING ---

const getNextFloorName = (floors: Floor[]): string => {
    const floorNumbers = floors
        .map(f => f.floor_name.match(/^Floor (\d+)$/))
        .filter(Boolean)
        .map(match => parseInt(match![1]));
    
    const nextNumber = floorNumbers.length > 0 ? Math.max(...floorNumbers) + 1 : 1;
    return `Floor ${nextNumber}`;
};

const getNextSectionName = (sections: Section[]): string => {
    const sectionLetters = sections
        .map(s => s.section_name.match(/^Section ([A-Z])$/))
        .filter(Boolean)
        .map(match => match![1]);

    if (sectionLetters.length === 0) return 'Section A';
    
    const maxCharCode = Math.max(...sectionLetters.map(letter => letter.charCodeAt(0)));
    const nextLetter = String.fromCharCode(maxCharCode + 1);
    return `Section ${nextLetter}`;
};

const getNextTableName = (tables: RestaurantTable[]): string => {
    const tableNumbers = tables
        .map(t => t.table_name.match(/^Table (\d+)$/))
        .filter(Boolean)
        .map(match => parseInt(match![1]));

    const nextNumber = tableNumbers.length > 0 ? Math.max(...tableNumbers) + 1 : 1;
    return `Table ${nextNumber}`;
};


// --- THE COMPONENT ---

interface CustomizeTablesProps {
  onBack: () => void;
}

export default function CustomizeTables({ onBack }: CustomizeTablesProps) {
    const { layout, loading, addFloor, addSection, addTable, deleteFloor, deleteSection, deleteTable } = useSettings();

    const handleAddFloor = () => {
        const newName = getNextFloorName(layout);
        addFloor(newName);
    };
    
    const handleAddSection = (floorId: string) => {
        const floor = layout.find(f => f.floor_id === floorId);
        if (floor) {
            const suggestedName = getNextSectionName(floor.sections || []);
            const newName = window.prompt('Enter section name:', suggestedName);
            if (newName && newName.trim()) {
                addSection(newName.trim(), floorId);
            }
        }
    };

    const handleAddTable = (sectionId: string) => {
        let section: Section | undefined;
        for (const floor of layout) {
            section = (floor.sections || []).find(s => s.section_id === sectionId);
            if (section) break;
        }

        if (section) {
            const newName = getNextTableName(section.tables || []);
            addTable(newName, sectionId);
        }
    };

    // THE FIX: Full implementation of delete handlers
    const handleDeleteFloor = (floorId: string, floorName: string) => {
        confirmAlert({
            title: 'Delete Floor',
            message: `Are you sure you want to delete "${floorName}"? This will also delete all its sections and tables.`,
            buttons: [
                {
                    label: 'Yes, Delete',
                    onClick: () => deleteFloor(floorId),
                    className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
                },
                {
                    label: 'Cancel',
                    onClick: () => {},
                    className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
                }
            ]
        });
    };

    const handleDeleteSection = (sectionId: string, sectionName: string) => {
        confirmAlert({
            title: 'Delete Section',
            message: `Are you sure you want to delete "${sectionName}"? This will also delete all its tables.`,
            buttons: [
                {
                    label: 'Yes, Delete',
                    onClick: () => deleteSection(sectionId),
                    className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
                },
                {
                    label: 'Cancel',
                    onClick: () => {},
                    className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
                }
            ]
        });
    };

    const handleDeleteTable = (sectionId: string) => {
        let section: Section | undefined;
        for (const floor of layout) {
            section = (floor.sections || []).find(s => s.section_id === sectionId);
            if (section) break;
        }

        if (section && section.tables && section.tables.length > 0) {
            // Find table with highest number
            const tableNumbers = section.tables
                .map(t => t.table_name.match(/^Table (\d+)$/))
                .filter(Boolean)
                .map(match => parseInt(match![1]));
            
            if (tableNumbers.length > 0) {
                const maxNumber = Math.max(...tableNumbers);
                const tableToDelete = section.tables.find(t => t.table_name === `Table ${maxNumber}`);
                
                if (tableToDelete) {
                    confirmAlert({
                        title: 'Delete Table',
                        message: `Are you sure you want to delete "${tableToDelete.table_name}"?`,
                        buttons: [
                            {
                                label: 'Yes, Delete',
                                onClick: () => deleteTable(tableToDelete.table_id),
                                className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
                            },
                            {
                                label: 'Cancel',
                                onClick: () => {},
                                className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
                            }
                        ]
                    });
                }
            }
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Customize Tables</h1>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
                {/* Add Floor Button */}
                <div className="mb-6 pb-6 border-b">
                    <button
                        onClick={handleAddFloor}
                        className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                    >
                        <Plus size={20} /> Add New Floor
                    </button>
                </div>

                {/* Display Layout */}
                {loading && <p className="text-gray-500">Loading layout...</p>}
                {!loading && (
                    <div className="space-y-6">
                        {layout.map((floor) => (
                            <div key={floor.floor_id}>
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-800">{floor.floor_name}</h3>
                                        <button onClick={() => handleDeleteFloor(floor.floor_id, floor.floor_name)} className="text-gray-400 hover:text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <button onClick={() => handleAddSection(floor.floor_id)} className="text-sm text-blue-600 font-semibold hover:underline">+ Add Section</button>
                                </div>
                                <div className="space-y-4 ml-4">
                                    {(floor.sections || []).map((section) => (
                                        <div key={section.section_id}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-gray-700">{section.section_name}</h4>
                                                    <button onClick={() => handleDeleteSection(section.section_id, section.section_name)} className="text-gray-400 hover:text-red-500">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleDeleteTable(section.section_id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Remove last table">
                                                        <Plus size={16} className="rotate-45" />
                                                    </button>
                                                    <button onClick={() => handleAddTable(section.section_id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Add table">
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-5 gap-2 pl-4">
                                                {(section.tables || []).map((table) => (
                                                    <div key={table.table_id} className="bg-gray-100 text-center py-2 px-4 rounded-md text-sm text-gray-800">
                                                        <span>{table.table_name}</span>
                                                    </div>
                                                ))}
                                                {(section.tables || []).length === 0 && <p className="text-xs text-gray-400 col-span-5">No tables in this section.</p>}
                                            </div>
                                        </div>
                                    ))}
                                    {(floor.sections || []).length === 0 && <p className="text-sm text-gray-400">No sections on this floor.</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}