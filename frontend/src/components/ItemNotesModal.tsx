"use client"

import { useState, useEffect } from "react"
import { X, Check } from "lucide-react"

// Fallback quick notes used when no global notes are configured
const FALLBACK_QUICK_NOTES = [
  "Less Spicy",
  "More Spicy",
  "Extra Spicy",
  "No Spice",
  "More Gravy",
  "Less Gravy",
  "Well Done",
  "Medium Done",
  "Extra Salt",
  "Less Salt",
  "No Onion",
  "No Garlic",
  "Extra Cheese",
  "No Oil",
]

interface ItemNotesModalProps {
  item: {
    name: string
    quick_notes?: string[]
  }
  currentNotes: string
  onSave: (notes: string) => void
  onClose: () => void
}

export function ItemNotesModal({ item, currentNotes, onSave, onClose }: ItemNotesModalProps) {
  const [globalQuickNotes, setGlobalQuickNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch global quick notes from settings
  useEffect(() => {
    const fetchGlobalNotes = async () => {
      try {
        const response = await fetch("/api/settings")
        const settings = await response.json()
        if (settings.global_quick_notes && Array.isArray(settings.global_quick_notes)) {
          setGlobalQuickNotes(settings.global_quick_notes)
        } else {
          setGlobalQuickNotes(FALLBACK_QUICK_NOTES)
        }
      } catch (error) {
        console.error("Error fetching global quick notes:", error)
        setGlobalQuickNotes(FALLBACK_QUICK_NOTES)
      } finally {
        setLoading(false)
      }
    }
    fetchGlobalNotes()
  }, [])

  // Item-specific notes (if any)
  const itemSpecificNotes = item.quick_notes && Array.isArray(item.quick_notes) && item.quick_notes.length > 0
    ? item.quick_notes
    : []

  // Combine: item-specific notes first, then global notes (excluding duplicates)
  const availableQuickNotes = [
    ...itemSpecificNotes,
    ...globalQuickNotes.filter(note => !itemSpecificNotes.includes(note))
  ]

  const [selectedNotes, setSelectedNotes] = useState<string[]>(() => {
    // Parse existing notes into array
    if (!currentNotes) return []
    return currentNotes.split(", ").filter((n) => n.trim())
  })
  const [customNote, setCustomNote] = useState("")

  const toggleQuickNote = (note: string) => {
    setSelectedNotes((prev) => {
      if (prev.includes(note)) {
        return prev.filter((n) => n !== note)
      }
      return [...prev, note]
    })
  }

  const addCustomNote = () => {
    if (customNote.trim() && !selectedNotes.includes(customNote.trim())) {
      setSelectedNotes((prev) => [...prev, customNote.trim()])
      setCustomNote("")
    }
  }

  const removeNote = (note: string) => {
    setSelectedNotes((prev) => prev.filter((n) => n !== note))
  }

  const handleSave = () => {
    onSave(selectedNotes.join(", "))
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Add Notes for {item.name}</h3>
          <button 
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Selected Notes Display */}
          {selectedNotes.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Selected Notes:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedNotes.map((note, index) => (
                  <div 
                    key={index} 
                    className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    <span>{note}</span>
                    <button 
                      onClick={() => removeNote(note)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Notes Buttons */}
          <div>
            <h4 className="font-medium text-sm text-gray-700 mb-2">Quick Notes:</h4>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableQuickNotes.map((note) => (
                  <button
                    key={note}
                    className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedNotes.includes(note)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    onClick={() => toggleQuickNote(note)}
                  >
                    {selectedNotes.includes(note) && <Check size={14} />}
                    {note}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Note Input */}
          <div>
            <h4 className="font-medium text-sm text-gray-700 mb-2">Custom Note:</h4>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Enter custom note..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addCustomNote()}
              />
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                onClick={addCustomNote} 
                disabled={!customNote.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button 
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
            onClick={handleSave}
          >
            <Check size={18} />
            Save Notes
          </button>
        </div>
      </div>
    </div>
  )
}
