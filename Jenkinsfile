pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'docker.io/your-username'
        IMAGE_NAME = 'food-delivery'
        SONAR_HOST = 'http://sonarqube:9000'
    }
    
    tools {
        nodejs 'NodeJS-24'
    }
    
    stages {
        stage('🔍 Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }
        
        stage('📦 Install Dependencies') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }
        
        stage('🔐 SAST - SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=food-delivery \
                          -Dsonar.sources=backend,frontend/src \
                          -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**
                    '''
                }
            }
        }
        
        stage('🔍 Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }
        
        stage('🛡️ Dependency Check') {
            parallel {
                stage('Backend Audit') {
                    steps {
                        dir('backend') {
                            sh 'npm audit --audit-level=moderate --json > npm-audit-backend.json || true'
                            archiveArtifacts artifacts: 'npm-audit-backend.json', allowEmptyArchive: true
                        }
                    }
                }
                stage('Frontend Audit') {
                    steps {
                        dir('frontend') {
                            sh 'npm audit --audit-level=moderate --json > npm-audit-frontend.json || true'
                            archiveArtifacts artifacts: 'npm-audit-frontend.json', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
        
        stage('🐳 Build Docker Images') {
            steps {
                script {
                    sh """
                        docker build -t ${IMAGE_NAME}-backend:${GIT_COMMIT_SHORT} ./backend
                        docker build -t ${IMAGE_NAME}-frontend:${GIT_COMMIT_SHORT} ./frontend
                    """
                }
            }
        }
        
        stage('🔒 Container Security Scan - Trivy') {
            steps {
                sh '''
                    # Install Trivy if not present
                    if ! command -v trivy &> /dev/null; then
                        wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add -
                        echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee -a /etc/apt/sources.list.d/trivy.list
                        apt-get update
                        apt-get install -y trivy
                    fi
                    
                    # Scan Backend Image
                    trivy image --severity HIGH,CRITICAL \
                        --format json \
                        --output trivy-backend.json \
                        ${IMAGE_NAME}-backend:${GIT_COMMIT_SHORT} || true
                    
                    # Scan Frontend Image
                    trivy image --severity HIGH,CRITICAL \
                        --format json \
                        --output trivy-frontend.json \
                        ${IMAGE_NAME}-frontend:${GIT_COMMIT_SHORT} || true
                '''
                archiveArtifacts artifacts: 'trivy-*.json', allowEmptyArchive: true
            }
        }
        
        stage('🚀 Deploy to Staging') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    docker compose -f docker-compose.yaml up -d
                '''
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo "✅ Pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
        failure {
            echo "❌ Pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
    }
}
