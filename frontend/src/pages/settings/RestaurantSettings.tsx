"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Save, ChevronDown, ChevronRight } from "lucide-react"
import api from "../../lib/api"
import { useRestaurantSettingsContext } from "../../contexts/useRestaurantSettingsContext"
import { toast } from "react-toastify"

interface RestaurantSettingsProps {
  onBack: () => void
}

interface Settings {
  id?: number
  restaurant_name: string
  address: string
  contact_number: string
  registration_number: string
  tax_rate: number
  currency?: string
}

interface Section {
  id: string
  name: string
  apply_vat: boolean
}

interface Floor {
  id: string
  name: string
  apply_vat: boolean
  sections: Section[]
}

export function RestaurantSettings({ onBack }: RestaurantSettingsProps) {
  const { refetch } = useRestaurantSettingsContext()
  const [activeTab, setActiveTab] = useState<"general" | "vat">("general")
  const [settings, setSettings] = useState<Settings>({
    restaurant_name: "",
    address: "",
    contact_number: "",
    registration_number: "",
    tax_rate: 0,
    currency: "OMR",
  })
  const [floors, setFloors] = useState<Floor[]>([])
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchFloorsWithSections()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get("/setting/settings")
      setSettings(response.data)
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const fetchFloorsWithSections = async () => {
    try {
      const response = await api.get("/setting/sections-vat")
      setFloors(response.data)
      // Expand all floors by default
      setExpandedFloors(new Set(response.data.map((f: Floor) => f.id)))
    } catch (error) {
      console.error("Error fetching floors/sections:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post("/setting/settings", settings)
      toast.success("Settings saved successfully!")
      await refetch()
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof Settings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const toggleFloorExpanded = (floorId: string) => {
    setExpandedFloors(prev => {
      const newSet = new Set(prev)
      if (newSet.has(floorId)) {
        newSet.delete(floorId)
      } else {
        newSet.add(floorId)
      }
      return newSet
    })
  }

  const handleFloorVatToggle = async (floorId: string) => {
    try {
      const response = await api.patch(`/setting/floors-vat/${floorId}/toggle`)
      setFloors(prev =>
        prev.map(floor =>
          floor.id === floorId
            ? { ...floor, apply_vat: response.data.apply_vat, sections: response.data.sections }
            : floor
        )
      )
    } catch (err) {
      toast.error("Failed to update floor VAT")
      console.error(err)
    }
  }

  const handleSectionVatToggle = async (floorId: string, sectionId: string) => {
    try {
      const response = await api.patch(`/setting/sections-vat/${sectionId}/toggle`)
      setFloors(prev =>
        prev.map(floor => {
          if (floor.id === floorId) {
            // Update the section
            const updatedSections = floor.sections.map(section =>
              section.id === sectionId
                ? { ...section, apply_vat: response.data.apply_vat }
                : section
            )
            // If floor_updated flag is true, also enable the floor
            return {
              ...floor,
              sections: updatedSections,
              apply_vat: response.data.floor_updated ? true : floor.apply_vat
            }
          }
          return floor
        })
      )
    } catch (err) {
      toast.error("Failed to update section VAT")
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Restaurant Settings</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === "general" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("vat")}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === "vat" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            VAT
          </button>
        </div>
      </div>

      {activeTab === "general" && (
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Restaurant Name *</label>
              <input
                type="text"
                value={settings.restaurant_name}
                onChange={(e) => handleChange("restaurant_name", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter restaurant name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
              <textarea
                value={settings.address}
                onChange={(e) => handleChange("address", e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter restaurant address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <input
                type="text"
                value={settings.contact_number}
                onChange={(e) => handleChange("contact_number", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
              <input
                type="text"
                value={settings.registration_number}
                onChange={(e) => handleChange("registration_number", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter business registration number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select
                value={settings.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="OMR">Omani Riyal (OMR)</option>
                <option value="INR">Indian Rupee (INR)</option>
                <option value="AED">UAE Dirham (AED)</option>
                <option value="SAR">Saudi Riyal (SAR)</option>
                <option value="USD">US Dollar (USD)</option>
              </select>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={20} />
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "vat" && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Rate</h2>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.tax_rate}
                onChange={(e) => handleChange("tax_rate", Number.parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter tax rate (e.g., 10 for 10%)"
              />
            </div>

            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Floors & Sections with VAT</h2>
              <div className="space-y-4">
                {floors.map(floor => (
                  <div key={floor.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Floor Header */}
                    <div className={`flex items-center justify-between p-4 ${floor.apply_vat ? 'bg-gray-50' : 'bg-gray-100'}`}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleFloorExpanded(floor.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedFloors.has(floor.id) ? (
                            <ChevronDown size={20} className="text-gray-600" />
                          ) : (
                            <ChevronRight size={20} className="text-gray-600" />
                          )}
                        </button>
                        <span className={`font-semibold ${floor.apply_vat ? 'text-gray-900' : 'text-gray-500'}`}>
                          {floor.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({floor.sections.length} sections)
                        </span>
                      </div>
                      <button
                        onClick={() => handleFloorVatToggle(floor.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${floor.apply_vat ? "bg-blue-600" : "bg-gray-300"
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${floor.apply_vat ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                      </button>
                    </div>

                    {/* Sections under this floor */}
                    {expandedFloors.has(floor.id) && floor.sections.length > 0 && (
                      <div className="border-t border-gray-200">
                        {floor.sections.map(section => (
                          <div
                            key={section.id}
                            className={`flex items-center justify-between p-4 pl-12 border-b border-gray-100 last:border-b-0 ${!floor.apply_vat ? 'bg-gray-50' : ''
                              }`}
                          >
                            <span className={`${section.apply_vat && floor.apply_vat ? 'text-gray-900' : 'text-gray-400'}`}>
                              {section.name}
                            </span>
                            <button
                              onClick={() => handleSectionVatToggle(floor.id, section.id)}
                              disabled={!floor.apply_vat}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!floor.apply_vat
                                  ? "bg-gray-200 cursor-not-allowed"
                                  : section.apply_vat
                                    ? "bg-blue-600"
                                    : "bg-gray-300"
                                }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${section.apply_vat ? "translate-x-6" : "translate-x-1"
                                  }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty state for floor with no sections */}
                    {expandedFloors.has(floor.id) && floor.sections.length === 0 && (
                      <div className="p-4 pl-12 text-gray-400 text-sm border-t border-gray-200">
                        No sections in this floor
                      </div>
                    )}
                  </div>
                ))}

                {floors.length === 0 && (
                  <div className="text-gray-500 text-center py-8">
                    No floors configured
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                <Save size={20} />
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
