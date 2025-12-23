
import React, { useState, useRef, useEffect } from 'react';
import { SystemSettings } from '../types';
import { Save, Upload, Camera, Building2, Layout, Loader2, FileText, CheckCircle, RefreshCcw, AlertTriangle, X } from 'lucide-react';
import { supabase, uploadFile } from '../utils/supabase';

interface SystemSettingsPageProps {
  settings: SystemSettings;
  onUpdate: (settings: SystemSettings) => void;
}

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ settings, onUpdate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    orgName: settings.orgName,
    appDescription: settings.appDescription,
    logoUrl: settings.logoUrl
  });

  // Sync internal state if props change (e.g. from a background realtime update)
  useEffect(() => {
    setFormData({
      orgName: settings.orgName,
      appDescription: settings.appDescription,
      logoUrl: settings.logoUrl
    });
    setPreviewUrl(settings.logoUrl);
  }, [settings]);

  // Logo Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(settings.logoUrl);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
          alert("File size too large. Max 2MB allowed.");
          return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSaveError(null);
    }
  };

  const handleSave = async () => {
    if (!formData.orgName.trim()) {
        alert("Organization name is required.");
        return;
    }

    setIsSaving(true);
    setIsSyncing(true);
    setSaveError(null);
    let finalLogoUrl = formData.logoUrl;

    try {
        // 1. Handle Logo Upload
        if (selectedFile) {
            const uploadedUrl = await uploadFile(selectedFile, 'avatars');
            if (uploadedUrl) {
                finalLogoUrl = uploadedUrl;
            } else {
                throw new Error("Logo upload failed. Please check your Storage policies.");
            }
        }

        // 2. Sync to Supabase Database
        const SETTINGS_ID = settings.id === 'default' ? '00000000-0000-0000-0000-000000000001' : settings.id;

        const { data, error } = await supabase
            .from('system_settings')
            .upsert({
                id: SETTINGS_ID,
                org_name: formData.orgName,
                app_description: formData.appDescription,
                logo_url: finalLogoUrl,
                updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })
            .select()
            .single();

        if (error) {
            console.error("Database Sync Error:", error);
            // Specific handling for "Schema Cache" or "Table not found"
            if (error.message.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
                throw new Error("The API cannot find the 'system_settings' table yet. Please run the SQL fix and wait 30 seconds for the Supabase cache to refresh.");
            }
            throw new Error(error.message || "Failed to synchronize with database.");
        }

        // 3. Update local state
        onUpdate({
            id: data.id,
            orgName: data.org_name,
            appDescription: data.app_description,
            logoUrl: data.logo_url
        });

        setSelectedFile(null);
        alert("System branding synchronized successfully!");
    } catch (err: any) {
        console.error("Sync error:", err);
        setSaveError(err.message || "An unexpected error occurred.");
    } finally {
        setIsSaving(false);
        setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">System Settings</h1>
          <p className="text-sm text-gray-400">Customize organization branding and application metadata.</p>
        </div>
        {isSyncing && (
            <div className="flex items-center text-blue-400 text-sm font-medium animate-pulse">
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                Syncing with Cloud...
            </div>
        )}
      </div>

      {saveError && (
          <div className="bg-red-900/20 border border-red-800/50 p-4 rounded-xl flex items-start space-x-3 animate-shake">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                  <h4 className="text-red-400 font-bold text-sm">Synchronization Failed</h4>
                  <p className="text-red-300/80 text-xs mt-1 leading-relaxed">
                      {saveError}
                  </p>
                  {saveError.includes('schema cache') && (
                    <div className="mt-3 p-2 bg-black/40 rounded border border-red-900/50 text-[10px] font-mono text-red-400 uppercase">
                        Tip: If you just ran the SQL, refresh this page and try again in 30 seconds.
                    </div>
                  )}
              </div>
              <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-400">
                  <X className="w-4 h-4" />
              </button>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6 flex flex-col items-center text-center relative overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 w-full text-left">Organization Logo</h3>
                
                <div 
                    className="relative group cursor-pointer mb-6" 
                    onClick={() => !isSaving && fileInputRef.current?.click()}
                >
                    <div className="w-40 h-40 rounded-2xl overflow-hidden border-2 border-dashed border-gray-600 group-hover:border-blue-500 transition-colors bg-gray-900 flex items-center justify-center">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-500">
                                <FileText className="w-10 h-10 mb-2" />
                                <span className="text-xs">No Logo Uploaded</span>
                            </div>
                        )}
                    </div>
                    {!isSaving && (
                        <div className="absolute inset-0 bg-black bg-opacity-40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                    )}
                    {isSaving && selectedFile && (
                        <div className="absolute inset-0 bg-gray-900/80 rounded-2xl flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    )}
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                    disabled={isSaving}
                />

                <p className="text-xs text-gray-500 mb-4 px-4">
                    Recommended: Square PNG or SVG. Max 2MB.
                </p>
                
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" />
                    <span>{previewUrl ? 'Change Logo' : 'Upload Logo'}</span>
                </button>
            </div>

            <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-6">
                <h4 className="text-blue-400 font-bold text-sm mb-2 flex items-center">
                    <Layout className="w-4 h-4 mr-2" />
                    Live Preview
                </h4>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 shadow-inner">
                    <div className="flex items-center space-x-3 mb-4 opacity-80">
                         <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                             {previewUrl ? (
                                <img src={previewUrl} className="w-full h-full object-contain p-1.5" alt="" />
                             ) : (
                                <FileText className="w-6 h-6 text-white" />
                             )}
                         </div>
                         <span className="text-sm font-bold text-white truncate max-w-[150px]">{formData.orgName || 'Organization Name'}</span>
                    </div>
                    <div className="space-y-1">
                        <div className="h-2 w-full bg-gray-800 rounded"></div>
                        <div className="h-2 w-3/4 bg-gray-800 rounded"></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 flex items-center">
                    <Building2 className="w-4 h-4 mr-2" />
                    General Information
                </h3>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Organization Name</label>
                        <input 
                            type="text" 
                            value={formData.orgName}
                            onChange={e => setFormData({...formData, orgName: e.target.value})}
                            disabled={isSaving}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white transition-all disabled:opacity-50"
                            placeholder="Enter organization title"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Application Description</label>
                        <textarea 
                            value={formData.appDescription}
                            onChange={e => setFormData({...formData, appDescription: e.target.value})}
                            disabled={isSaving}
                            rows={4}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white transition-all resize-none disabled:opacity-50"
                            placeholder="Enter short description..."
                        />
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-700 flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 min-w-[200px] justify-center"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Synchronizing...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Save & Sync Branding
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
