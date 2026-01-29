pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'docker.io/your-username'
        IMAGE_NAME = 'food-delivery'
        SONAR_HOST = 'http://sonarqube:9000'
    }
    
    tools {
        nodejs 'nodejs-24'
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
            sh """
                /usr/local/bin/sonar-scanner \
                  -Dsonar.projectKey=food-delivery \
                  -Dsonar.sources=backend,frontend/src \
                  -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**
            """
        }
    }
}



 //stage('🔍 Quality Gate') {
    //steps {
        //timeout(time: 5, unit: 'MINUTES') {
        //    waitForQualityGate abortPipeline: true
        //}
    //}
 //}

        
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
        echo "✅ Security scan complete!"
    }
}


stage('🚀 Deploy to Staging') {
    steps {
        sh '''
            cd ~/Desktop/food_del_prj_fed
            
            docker compose -f docker-compose.yml down -v --remove-orphans
            docker ps -a | grep food- | awk '{print $1}' | xargs -r docker rm -f
            docker compose -f docker-compose.yml up -d
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
