
import React, { useState, useRef } from 'react';
import { SystemSettings } from '../types';
import { Save, Upload, Camera, Building2, Layout, Loader2, FileText, CheckCircle } from 'lucide-react';
import { supabase, uploadFile } from '../utils/supabase';

interface SystemSettingsPageProps {
  settings: SystemSettings;
  onUpdate: (settings: SystemSettings) => void;
}

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ settings, onUpdate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    orgName: settings.orgName,
    appDescription: settings.appDescription,
    logoUrl: settings.logoUrl
  });

  // Logo Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(settings.logoUrl);
  const [uploadProgress, setUploadProgress] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!formData.orgName.trim()) {
        alert("Organization name is required.");
        return;
    }

    setIsSaving(true);
    let finalLogoUrl = formData.logoUrl;

    try {
        // 1. Handle Logo Upload if changed
        if (selectedFile) {
            setUploadProgress(true);
            const uploadedUrl = await uploadFile(selectedFile, 'avatars'); // Reuse avatar bucket or specific system bucket
            if (uploadedUrl) {
                finalLogoUrl = uploadedUrl;
            }
            setUploadProgress(false);
        }

        // 2. Sync to Supabase
        // We use an UPSERT or specific UPDATE based on ID
        const { error } = await supabase
            .from('system_settings')
            .upsert({
                id: settings.id === 'default' ? undefined : settings.id,
                org_name: formData.orgName,
                app_description: formData.appDescription,
                logo_url: finalLogoUrl,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        onUpdate({
            ...settings,
            orgName: formData.orgName,
            appDescription: formData.appDescription,
            logoUrl: finalLogoUrl
        });

        alert("System settings updated successfully!");
    } catch (err) {
        console.error("Error saving settings:", err);
        alert("Failed to save system settings.");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-sm text-gray-400">Customize organization branding and application metadata.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Branding & Logo */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6 flex flex-col items-center text-center">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 w-full text-left">Organization Logo</h3>
                
                <div className="relative group cursor-pointer mb-6" onClick={() => fileInputRef.current?.click()}>
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
                    <div className="absolute inset-0 bg-black bg-opacity-40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-8 h-8 text-white" />
                    </div>
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                />

                <p className="text-xs text-gray-500 mb-4 px-4">
                    Recommended: Square PNG or SVG with transparent background. Max size 2MB.
                </p>
                
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                    <Upload className="w-4 h-4" />
                    <span>Upload New Logo</span>
                </button>
            </div>

            <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-6">
                <h4 className="text-blue-400 font-bold text-sm mb-2 flex items-center">
                    <Layout className="w-4 h-4 mr-2" />
                    Live Preview
                </h4>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 shadow-inner">
                    <div className="flex items-center space-x-3 mb-4 opacity-80">
                         <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center overflow-hidden">
                             {previewUrl ? (
                                <img src={previewUrl} className="w-full h-full object-contain p-1" alt="" />
                             ) : (
                                <FileText className="w-4 h-4 text-white" />
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

        {/* Right: Form Details */}
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
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white transition-all"
                            placeholder="Enter organization title"
                        />
                        <p className="text-xs text-gray-500 mt-2">This name appears in the Sidebar and Login screens.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Application Description</label>
                        <textarea 
                            value={formData.appDescription}
                            onChange={e => setFormData({...formData, appDescription: e.target.value})}
                            rows={4}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white transition-all resize-none"
                            placeholder="Enter short description..."
                        />
                        <p className="text-xs text-gray-500 mt-2">This text is displayed on the main Login landing page.</p>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-700 flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving || uploadProgress}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Saving Changes...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Save All Settings
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
